import { Router } from 'express';
import { Movie } from '../models/Movie.js';
import { requireRole } from '../services/sessionService.js';
import { auditRequest } from '../events/audit.js';
import {
  escapeRegex,
  isPlainString,
  isValidObjectId,
  sanitizeMoviePayload
} from '../utils/securityMiddleware.js';

export const movieRouter = Router();

const cache = new Map();
const CACHE_TTL_MS = 5000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  if (cache.size > 200) {
    cache.clear();
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearMovieCache(broadcast = true) {
  cache.clear();
  if (broadcast && process.send) {
    process.send({ type: 'CLEAR_MOVIE_CACHE', originPid: process.pid });
  }
}

if (process.on) {
  process.on('message', (msg) => {
    if (msg && msg.type === 'CLEAR_MOVIE_CACHE' && msg.originPid !== process.pid) {
      cache.clear();
    }
  });
}

movieRouter.get('/', async (req, res) => {
  try {
    const cacheKey = req.originalUrl || req.url;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const { genre, director, minRating, search } = req.query;
    const filter = {};

    if (genre !== undefined) {
      if (!isPlainString(genre, 50)) {
        return res.status(400).json({ error: 'Paramètre genre invalide' });
      }
      if (genre.trim()) {
        filter.genres = genre.trim();
      }
    }

    if (director !== undefined) {
      if (!isPlainString(director, 100)) {
        return res.status(400).json({ error: 'Paramètre réalisateur invalide' });
      }
      if (director.trim()) {
        filter.director = new RegExp(escapeRegex(director.trim()), 'i');
      }
    }

    if (minRating !== undefined) {
      const parsedRating = Number.parseFloat(String(minRating));
      if (Number.isNaN(parsedRating) || parsedRating < 0 || parsedRating > 10) {
        return res.status(400).json({ error: 'Paramètre minRating invalide' });
      }
      filter['ratings.imdb'] = { $gte: parsedRating };
    }

    if (search !== undefined) {
      if (!isPlainString(search, 120)) {
        return res.status(400).json({ error: 'Paramètre de recherche invalide' });
      }
      if (search.trim()) {
        const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
        filter.$or = [
          { title: searchRegex },
          { director: searchRegex },
          { genres: searchRegex },
          { tags: searchRegex },
          { synopsis: searchRegex }
        ];
      }
    }

    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);
    const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [totalCount, movies] = await Promise.all([
      Movie.countDocuments(filter),
      Movie.find(filter)
        .select('title director year genres duration ratings.imdb poster')
        .sort({ year: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const responsePayload = {
      count: totalCount,
      total: totalCount,
      page,
      limit,
      data: movies
    };

    setCache(cacheKey, responsePayload);
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(responsePayload);
  } catch {
    return res.status(500).json({ error: 'Erreur lors de la récupération des films' });
  }
});

movieRouter.get('/:id', async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant de film invalide' });
  }
  try {
    const movie = await Movie.findById(req.params.id).select('-__v').lean();
    if (!movie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    return res.json(movie);
  } catch {
    return res.status(400).json({ error: 'Identifiant de film invalide' });
  }
});

movieRouter.post('/', requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const payload = sanitizeMoviePayload(req.body);
    if (!payload || !payload.title || !payload.director || !payload.year) {
      return res.status(400).json({ error: 'Données de film invalides ou incomplètes' });
    }
    const newMovie = new Movie(payload);
    const savedMovie = await newMovie.save();
    clearMovieCache();
    await auditRequest(req, 'MOVIE_CREATE', {
      target: { type: 'movie', id: String(savedMovie._id) },
      after: payload
    });
    return res.status(201).json({
      message: 'Film créé avec succès !',
      data: savedMovie
    });
  } catch {
    return res.status(400).json({ error: 'Impossible de créer le film' });
  }
});

movieRouter.put('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant de film invalide' });
  }
  try {
    const payload = sanitizeMoviePayload(req.body);
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Données de mise à jour invalides' });
    }
    const before = await Movie.findById(req.params.id).select(Object.keys(payload).join(' ')).lean();
    if (!before) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).select('-__v');
    if (!updatedMovie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    clearMovieCache();
    await auditRequest(req, 'MOVIE_UPDATE', {
      target: { type: 'movie', id: req.params.id },
      before,
      after: payload
    });
    return res.json({
      message: 'Film mis à jour avec succès !',
      data: updatedMovie
    });
  } catch {
    return res.status(400).json({ error: 'Impossible de mettre à jour le film' });
  }
});

movieRouter.delete('/:id', requireRole('SUPER_ADMIN'), async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: 'Identifiant de film invalide' });
  }
  try {
    const deletedMovie = await Movie.findByIdAndDelete(req.params.id);
    if (!deletedMovie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    clearMovieCache();
    await auditRequest(req, 'MOVIE_DELETE', {
      target: { type: 'movie', id: req.params.id },
      before: { title: deletedMovie.title, director: deletedMovie.director, year: deletedMovie.year }
    });
    return res.json({
      message: 'Film supprimé avec succès !',
      deletedId: req.params.id
    });
  } catch {
    return res.status(400).json({ error: 'Impossible de supprimer le film' });
  }
});

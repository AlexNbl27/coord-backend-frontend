import { Router } from 'express';
import { Movie } from '../models/Movie.js';

export const movieRouter = Router();

// ==========================================
// 🚀 Cache mémoire léger (TTL 5s) avec invalidation
// ==========================================
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

export function clearMovieCache() {
  cache.clear();
}

// ==========================================
// 1. GET ALL - Récupérer les films avec pagination et cache
// ==========================================
movieRouter.get('/', async (req, res) => {
  try {
    const cacheKey = req.originalUrl || req.url;
    const cachedData = getCached(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const { genre, director, minRating, search } = req.query;
    const filter = {};

    if (genre) {
      // Utilisation directe pour exploiter l'index composite B-Tree
      filter.genres = genre;
    }
    if (director) {
      filter.director = new RegExp(director, 'i');
    }
    if (minRating) {
      filter['ratings.imdb'] = { $gte: parseFloat(minRating) };
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { title: searchRegex },
        { director: searchRegex },
        { genres: searchRegex },
        { tags: searchRegex },
        { synopsis: searchRegex }
      ];
    }

    // Pagination pour préserver la mémoire vive sous forte affluence
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // Exécution parallèle du comptage total et de la récupération projetée (.lean() + .select())
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
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. GET BY ID - Récupérer un film spécifique
// ==========================================
movieRouter.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).lean();
    if (!movie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    res.json(movie);
  } catch (error) {
    res.status(400).json({ error: 'Identifiant invalide : ' + error.message });
  }
});

// ==========================================
// 3. POST - Créer un nouveau film (CREATE)
// ==========================================
movieRouter.post('/', async (req, res) => {
  try {
    const newMovie = new Movie(req.body);
    const savedMovie = await newMovie.save();
    clearMovieCache(); // Invalidation du cache de lecture
    res.status(201).json({
      message: 'Film créé avec succès !',
      data: savedMovie
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// 4. PUT - Mettre à jour un film (UPDATE)
// ==========================================
movieRouter.put('/:id', async (req, res) => {
  try {
    const updatedMovie = await Movie.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedMovie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    clearMovieCache();
    res.json({
      message: 'Film mis à jour avec succès !',
      data: updatedMovie
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// 5. DELETE - Supprimer un film (DELETE)
// ==========================================
movieRouter.delete('/:id', async (req, res) => {
  try {
    const deletedMovie = await Movie.findByIdAndDelete(req.params.id);
    if (!deletedMovie) {
      return res.status(404).json({ error: 'Film non trouvé' });
    }
    clearMovieCache();
    res.json({
      message: 'Film supprimé avec succès !',
      deletedId: req.params.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

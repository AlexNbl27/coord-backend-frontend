import { Router } from 'express';
import { Movie } from '../models/Movie.js';

export const movieRouter = Router();

// ==========================================
// 1. GET ALL - Récupérer tous les films (avec filtres optionnels)
// ==========================================
movieRouter.get('/', async (req, res) => {
  try {
    const { genre, director, minRating, search } = req.query;
    const filter = {};

    if (genre) {
      filter.genres = { $in: [new RegExp(genre, 'i')] };
    }
    if (director) {
      filter.director = new RegExp(director, 'i');
    }
    if (minRating) {
      filter['ratings.imdb'] = { $gte: parseFloat(minRating) };
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const movies = await Movie.find(filter).sort({ year: -1 });
    res.json({
      count: movies.length,
      data: movies
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. GET BY ID - Récupérer un film spécifique
// ==========================================
movieRouter.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
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
    res.json({
      message: 'Film supprimé avec succès !',
      deletedId: req.params.id
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

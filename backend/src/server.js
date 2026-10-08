import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { movieRouter } from './routes/movieRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cours_db?directConnection=true';

// Middlewares
app.use(cors());
app.use(express.json());

// Racine
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API du projet YNOV (Backend) !',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      getAllMovies: 'GET /api/movies',
      getOneMovie: 'GET /api/movies/:id',
      createMovie: 'POST /api/movies',
      updateMovie: 'PUT /api/movies/:id',
      deleteMovie: 'DELETE /api/movies/:id'
    }
  });
});

// Santé
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Routes CRUD
app.use('/api/movies', movieRouter);

// Connexion MongoDB & Démarrage
async function startServer() {
  try {
    console.log(`[MongoDB] Connexion en cours à : ${MONGO_URI}...`);
    await mongoose.connect(MONGO_URI);
    console.log('[MongoDB] Connecté avec succès !');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] Serveur Express en écoute sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[MongoDB] Erreur de connexion :', err.message);
    process.exit(1);
  }
}

startServer();

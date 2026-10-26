import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cluster from 'node:cluster';
import os from 'node:os';
import cookieParser from 'cookie-parser';
import { movieRouter } from './routes/movieRoutes.js';
import { abRouter } from './routes/abRoutes.js';
import { slotRouter } from './routes/slotRoutes.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cours_db?directConnection=true';
const numCPUs = process.env.WEB_CONCURRENCY
  ? parseInt(process.env.WEB_CONCURRENCY, 10)
  : (os.availableParallelism ? os.availableParallelism() : os.cpus().length);

function createServer() {
  const app = express();

  // Middlewares
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Racine
  app.get('/', (req, res) => {
    res.json({
      message: 'Bienvenue sur l\'API du projet YNOV (Backend) !',
      version: '1.0.0',
      workerPid: process.pid,
      endpoints: {
        health: 'GET /health',
        getAllMovies: 'GET /api/movies',
        getOneMovie: 'GET /api/movies/:id',
        createMovie: 'POST /api/movies',
        updateMovie: 'PUT /api/movies/:id',
        deleteMovie: 'DELETE /api/movies/:id',
        slots: 'GET /api/slots',
        slotReservations: 'POST /api/slots/:id/reservations',
        slotEvents: 'GET /api/slots/events',
        abAssignment: 'GET /api/ab/assignment',
        abExposure: 'POST /api/ab/exposure',
        abMetrics: 'GET /api/ab/metrics'
      }
    });
  });

  // Santé
  app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
      status: 'OK',
      database: dbStatus,
      workerPid: process.pid,
      timestamp: new Date().toISOString()
    });
  });

  // Routes API
  app.use('/api/movies', movieRouter);
  app.use('/api/slots', slotRouter);
  app.use('/api/ab', abRouter);

  return app;
}

// Connexion MongoDB & Démarrage du Worker
async function startWorker() {
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connecté avec succès (Worker ${process.pid}) !`);

    const app = createServer();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] Worker ${process.pid} en écoute sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(`[Worker ${process.pid}] Erreur de démarrage :`, err.message);
    process.exit(1);
  }
}

// Gestion du clustering multi-cœurs
if (cluster.isPrimary && numCPUs > 1) {
  console.log(`[Cluster] Master ${process.pid} lance ${numCPUs} workers...`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} arrêté. Redémarrage...`);
    cluster.fork();
  });
} else {
  startWorker();
}


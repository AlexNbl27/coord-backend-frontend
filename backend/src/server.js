import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cluster from 'node:cluster';
import os from 'node:os';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { trace, isSpanContextValid, SpanStatusCode } from '@opentelemetry/api';
import { movieRouter } from './routes/movieRoutes.js';
import { abRouter } from './routes/abRoutes.js';
import { slotRouter } from './routes/slotRoutes.js';
import { sessionRouter } from './routes/sessionRoutes.js';
import { ticketRouter } from './routes/ticketRoutes.js';
import { cinemaRouter } from './routes/cinemaRoutes.js';
import { seedCinemas } from './geo/cinemas.js';
import { attachSession } from './services/sessionService.js';
import { securityHeaders, createRateLimiter } from './utils/securityMiddleware.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/cours_db?directConnection=true';
const defaultCPUs = typeof os.availableParallelism === 'function'
  ? os.availableParallelism()
  : os.cpus().length;
const numCPUs = process.env.WEB_CONCURRENCY
  ? parseInt(process.env.WEB_CONCURRENCY, 10)
  : defaultCPUs;

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3001,http://localhost:5173,http://127.0.0.1:3001,http://127.0.0.1:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
);

function createServer() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(compression());

  app.use(cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.has(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['X-Trace-Id', 'Content-Disposition'],
    maxAge: 86400
  }));

  app.use(createRateLimiter({ windowMs: 60_000, max: 600 }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use(attachSession);

  app.use((_req, res, next) => {
    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    if (ctx && isSpanContextValid(ctx)) {
      res.setHeader('X-Trace-Id', ctx.traceId);
    }
    next();
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'cineslot-api',
      version: '1.0.0',
      status: 'OK'
    });
  });

  const healthHandler = (_req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
      status: 'OK',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  };
  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api/movies', movieRouter);
  app.use('/api/slots', slotRouter);
  app.use('/api/ab', abRouter);
  app.use('/api/session', sessionRouter);
  app.use('/api/bookings', ticketRouter);
  app.use('/api/cinemas', cinemaRouter);

  app.use((err, _req, res, _next) => {
    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    if (span) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.name || 'Error' });
    }
    if (ctx && isSpanContextValid(ctx) && !res.headersSent) {
      res.setHeader('X-Trace-Id', ctx.traceId);
    }
    const status = err.status || 500;
    res.status(status).json({
      message: status >= 500 ? 'Le service est momentanément indisponible.' : err.message
    });
  });

  return app;
}

async function startWorker() {
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[MongoDB] Connected (worker ${process.pid})`);
    await seedCinemas().catch((err) => console.error('[Cinemas] Seed failed:', err.message));

    const app = createServer();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[API] Worker ${process.pid} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error(`[Worker ${process.pid}] Startup error:`, err.message);
    process.exit(1);
  }
}

if (cluster.isPrimary && numCPUs > 1) {
  console.log(`[Cluster] Primary ${process.pid} starting ${numCPUs} workers`);

  const setupWorker = (w) => {
    w.on('message', (msg) => {
      if (msg && (msg.type === 'BROADCAST_SSE' || msg.type === 'CLEAR_MOVIE_CACHE')) {
        for (const id in cluster.workers) {
          cluster.workers[id]?.send(msg);
        }
      }
    });
  };

  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    setupWorker(worker);
  }

  cluster.on('exit', (worker) => {
    console.log(`[Cluster] Worker ${worker.process.pid} exited. Restarting...`);
    const newWorker = cluster.fork();
    setupWorker(newWorker);
  });
} else {
  startWorker();
}

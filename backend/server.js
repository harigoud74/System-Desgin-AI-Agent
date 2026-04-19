/**
 * server.js — Memory-First System Design Agent
 * ─────────────────────────────────────────────────────────────
 * Entry point for the Express backend.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const { initDb } = require('./services/sqlPersistence');
const designRouter = require('./routes/design');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate limiting (protect LLM endpoint) ────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max:      20,
  message:  { error: 'Too many requests. Please wait a moment.' },
});
app.use('/api/generate-design', limiter);

// ─── Routes ───────────────────────────────────────────────────
app.use('/api', designRouter);

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────
async function start() {
  try {
    // Boot the SQL connection pool
    initDb();
    console.log('[server] Database pool ready');

    app.listen(PORT, () => {
      console.log(`\n🧠  Memory-First System Design Agent`);
      console.log(`    Backend listening on http://localhost:${PORT}`);
      console.log(`    POST http://localhost:${PORT}/api/generate-design`);
      console.log(`    GET  http://localhost:${PORT}/api/health\n`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();

/**
 * sqlPersistence.js
 * ─────────────────────────────────────────────────────────────
 * MySQL / mysql2 connection pool + helper functions.
 * Uses a singleton pool pattern so the connection is shared
 * across all service modules without reconnecting per request.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const mysql = require('mysql2/promise');

let pool = null;

/** Initialize the pool (call once at startup) */
function initDb() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'hari7075057297@',
    database: process.env.DB_NAME || 'memory_design_agent',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
    charset: 'utf8mb4',
  });

  console.log('[DB] MySQL pool initialized');
  return pool;
}

/** Return the existing pool (throws if not initialized) */
function getDb() {
  if (!pool) throw new Error('DB pool not initialized. Call initDb() first.');
  return pool;
}

// ─────────────────────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────────────────────

/** Upsert a user by their public ID and return the internal ID */
async function upsertUser(publicUserId) {
  const db = getDb();
  await db.query(
    'INSERT IGNORE INTO users (public_user_id) VALUES (?)',
    [publicUserId]
  );
  const [[row]] = await db.query(
    'SELECT id FROM users WHERE public_user_id = ?',
    [publicUserId]
  );
  return row.id;
}

// ─────────────────────────────────────────────────────────────
// Project helpers
// ─────────────────────────────────────────────────────────────

/** Create or update a project for a user */
async function upsertProject(userId, title, latestIdea) {
  const db = getDb();

  // Check if a project with similar title already exists
  const [[existing]] = await db.query(
    'SELECT id FROM projects WHERE user_id = ? AND title = ? LIMIT 1',
    [userId, title]
  );

  if (existing) {
    await db.query(
      'UPDATE projects SET latest_idea = ?, updated_at = NOW() WHERE id = ?',
      [latestIdea, existing.id]
    );
    return existing.id;
  } else {
    const [result] = await db.query(
      'INSERT INTO projects (user_id, title, latest_idea) VALUES (?, ?, ?)',
      [userId, title, latestIdea]
    );
    return result.insertId;
  }
}

// ─────────────────────────────────────────────────────────────
// Design run helpers
// ─────────────────────────────────────────────────────────────

/** Persist a completed design run and return its ID */
async function saveDesignRun({ projectId, idea, report, memoryRecalled, memoryLearned, durationMs }) {
  const db = getDb();
  const [result] = await db.query(
    `INSERT INTO design_runs
       (project_id, idea, final_report_json, memory_recalled_json, memory_learned_json, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      idea,
      JSON.stringify(report),
      JSON.stringify(memoryRecalled || []),
      JSON.stringify(memoryLearned || []),
      durationMs || 0,
    ]
  );
  return result.insertId;
}

/** Fetch recent design runs for a user (for history/context) */
async function getRecentRunsForUser(publicUserId, limit = 5) {
  const db = getDb();
  const [rows] = await db.query(
    `SELECT dr.id, dr.idea, dr.created_at, dr.memory_recalled_json, dr.memory_learned_json
     FROM design_runs dr
     JOIN projects p ON dr.project_id = p.id
     JOIN users u ON p.user_id = u.id
     WHERE u.public_user_id = ?
     ORDER BY dr.created_at DESC
     LIMIT ?`,
    [publicUserId, limit]
  );
  return rows;
}

module.exports = {
  initDb,
  getDb,
  upsertUser,
  upsertProject,
  saveDesignRun,
  getRecentRunsForUser,
};

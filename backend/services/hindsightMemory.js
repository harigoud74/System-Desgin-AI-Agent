/**
 * hindsightMemory.js
 * ─────────────────────────────────────────────────────────────
 * Hindsight integration for long-term, per-user memory.
 *
 * Hindsight is an open-source memory layer that lets you store,
 * retrieve, and reflect on structured memories with semantic
 * search. Each user gets their own "bank" so memories never
 * bleed across users.
 *
 * Docs / self-host: https://github.com/hindsight-ai/hindsight
 *
 * Pattern used here:
 *   bankId = "user-{userId}"   ← one bank per user
 *
 * Fallback behaviour:
 *   If Hindsight is unreachable, we fall back to the SQL cache
 *   table `hindsight_memory_cache` so the app never hard-fails.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const axios = require('axios');
const { getDb } = require('./sqlPersistence');

const BASE_URL = process.env.HINDSIGHT_BASE_URL || 'http://localhost:8000';
const API_KEY  = process.env.HINDSIGHT_API_KEY  || '';
const RECALL_LIMIT     = parseInt(process.env.MEMORY_RECALL_LIMIT     || '10', 10);
const SCORE_THRESHOLD  = parseFloat(process.env.MEMORY_SCORE_THRESHOLD || '0.5');

/** Build the per-user bank identifier */
function bankId(userId) {
  return `user-${userId}`;
}

/** Shared Axios instance with auth header */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
});

// ─────────────────────────────────────────────────────────────
// RECALL — fetch relevant memories before generation
// ─────────────────────────────────────────────────────────────
async function recallMemories(userId, query) {
  const bank = bankId(userId);

  try {
    /**
     * Hindsight recall endpoint (adjust path to match your version):
     *   POST /api/recall
     *   { bank_id, query, top_k, threshold }
     *
     * Returns: { memories: [{ key, value, score }] }
     */
    const res = await client.post('/api/recall', {
      bank_id:   bank,
      query:     query,
      top_k:     RECALL_LIMIT,
      threshold: SCORE_THRESHOLD,
    });

    const memories = (res.data.memories || []).map(m => ({
      key:   m.key   || m.memory_key,
      value: m.value || m.memory_val,
      score: m.score || 1.0,
    }));

    console.log(`[Hindsight] Recalled ${memories.length} memories for bank: ${bank}`);
    return memories;

  } catch (err) {
    console.warn('[Hindsight] recall failed, falling back to SQL cache:', err.message);
    return recallFromSqlCache(userId, query);
  }
}

// ─────────────────────────────────────────────────────────────
// RETAIN — store new durable memories after generation
// ─────────────────────────────────────────────────────────────
async function retainMemories(userId, memories, runId = null) {
  const bank = bankId(userId);

  /** memories = [{ key: string, value: string }] */
  const results = [];

  for (const mem of memories) {
    try {
      /**
       * Hindsight retain endpoint:
       *   POST /api/retain
       *   { bank_id, key, value }
       */
      await client.post('/api/retain', {
        bank_id: bank,
        key:     mem.key,
        value:   mem.value,
      });
      results.push({ ...mem, stored: true });

    } catch (err) {
      console.warn(`[Hindsight] retain failed for key "${mem.key}", writing to SQL cache:`, err.message);
      await retainToSqlCache(userId, mem, runId);
      results.push({ ...mem, stored: false, fallback: 'sql' });
    }
  }

  console.log(`[Hindsight] Retained ${results.length} memories for bank: ${bank}`);
  return results;
}

// ─────────────────────────────────────────────────────────────
// REFLECT — ask Hindsight to summarize/condense the bank
// (optional; call periodically or after many runs)
// ─────────────────────────────────────────────────────────────
async function reflectMemories(userId) {
  const bank = bankId(userId);
  try {
    const res = await client.post('/api/reflect', { bank_id: bank });
    console.log(`[Hindsight] Reflected bank: ${bank}`);
    return res.data;
  } catch (err) {
    console.warn('[Hindsight] reflect failed:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// SQL FALLBACK — used when Hindsight is unreachable
// ─────────────────────────────────────────────────────────────
async function recallFromSqlCache(userId, query) {
  try {
    const db = getDb();
    // Simple keyword-based fallback (not semantic)
    const words = query.toLowerCase().split(/\s+/).slice(0, 5);
    const like  = words.map(w => `memory_val LIKE '%${w}%'`).join(' OR ');
    const [rows] = await db.query(
      `SELECT memory_key AS \`key\`, memory_val AS value
       FROM hindsight_memory_cache
       WHERE user_id = (SELECT id FROM users WHERE public_user_id = ?)
         AND (${like})
       ORDER BY created_at DESC LIMIT ?`,
      [userId, RECALL_LIMIT]
    );
    return rows.map(r => ({ key: r.key, value: r.value, score: 0.7, source: 'sql_cache' }));
  } catch (e) {
    console.error('[SQLCache] recallFromSqlCache error:', e.message);
    return [];
  }
}

async function retainToSqlCache(userId, mem, runId) {
  try {
    const db = getDb();
    await db.query(
      `INSERT INTO hindsight_memory_cache (user_id, bank_id, memory_key, memory_val, source_run)
       VALUES (
         (SELECT id FROM users WHERE public_user_id = ? LIMIT 1),
         ?, ?, ?, ?
       )
       ON DUPLICATE KEY UPDATE memory_val = VALUES(memory_val)`,
      [userId, bankId(userId), mem.key, mem.value, runId || null]
    );
  } catch (e) {
    console.error('[SQLCache] retainToSqlCache error:', e.message);
  }
}

module.exports = { recallMemories, retainMemories, reflectMemories };

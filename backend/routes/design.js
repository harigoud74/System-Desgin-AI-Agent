/**
 * design.js — Express route
 * ─────────────────────────────────────────────────────────────
 * POST /api/generate-design
 * GET  /api/health
 * GET  /api/history/:userId
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { Router }            = require('express');
const { recallMemories, retainMemories } = require('../services/hindsightMemory');
const { generateDesignReport }           = require('../services/llmOrchestrator');
const {
  upsertUser,
  upsertProject,
  saveDesignRun,
  getRecentRunsForUser,
} = require('../services/sqlPersistence');

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// GET /api/history/:userId
// Returns recent design runs for a user
// ─────────────────────────────────────────────────────────────
router.get('/history/:userId', async (req, res) => {
  try {
    const runs = await getRecentRunsForUser(req.params.userId, 10);
    res.json({ runs });
  } catch (err) {
    console.error('[route/history] error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/generate-design
// Main agent endpoint — full memory → generate → store flow
// ─────────────────────────────────────────────────────────────
router.post('/generate-design', async (req, res) => {
  const startTime = Date.now();
  const { userId, idea } = req.body;

  // ── Validate ─────────────────────────────────────────────
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: '`userId` is required (string).' });
  }
  if (!idea || typeof idea !== 'string' || idea.trim().length < 10) {
    return res.status(400).json({ error: '`idea` must be at least 10 characters.' });
  }

  try {
    // ── 1. Ensure user exists in SQL ──────────────────────
    const dbUserId = await upsertUser(userId.trim());

    // ── 2. Recall relevant memory from Hindsight ─────────
    console.log(`[agent] Recalling memories for user: ${userId}`);
    const memoryRecalled = await recallMemories(userId.trim(), idea.trim());

    // ── 3. Generate design report via LLM (multi-stage) ──
    console.log(`[agent] Generating design for idea: "${idea.slice(0, 80)}..."`);
    const { report, memoryLearned } = await generateDesignReport({
      idea:           idea.trim(),
      memoryRecalled,
    });

    // ── 4. Persist project + design run in SQL ────────────
    const projectId = await upsertProject(
      dbUserId,
      report.projectTitle || idea.slice(0, 100),
      idea.trim()
    );

    const runId = await saveDesignRun({
      projectId,
      idea:           idea.trim(),
      report,
      memoryRecalled,
      memoryLearned,
      durationMs:     Date.now() - startTime,
    });

    // ── 5. Retain new memories in Hindsight ──────────────
    console.log(`[agent] Retaining ${memoryLearned.length} new memories...`);
    await retainMemories(userId.trim(), memoryLearned, runId);

    // ── 6. Respond ────────────────────────────────────────
    return res.json({
      runId,
      memoryRecalled,

      // Report sections
      projectSummary:            report.projectSummary,
      userRoles:                 report.userRoles,
      coreFeatures:              report.coreFeatures,
      suggestedImprovements:     report.suggestedImprovements,
      functionalRequirements:    report.functionalRequirements,
      nonFunctionalRequirements: report.nonFunctionalRequirements,
      systemModules:             report.systemModules,
      architectureFlow:          report.architectureFlow,
      databaseEntities:          report.databaseEntities,
      apiEndpoints:              report.apiEndpoints,
      developmentPlan:           report.developmentPlan,
      deploymentPlan:            report.deploymentPlan,
      assemblyGuide:             report.assemblyGuide,
      techStackSummary:          report.techStackSummary,

      memoryLearned,

      meta: {
        durationMs:  Date.now() - startTime,
        generatedAt: new Date().toISOString(),
      },
    });

  } catch (err) {
    console.error('[route/generate-design] error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;

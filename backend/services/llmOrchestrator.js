/**
 * llmOrchestrator.js
 * ─────────────────────────────────────────────────────────────
 * Multi-stage AI orchestration for system design generation.
 * Uses Groq (free tier) with llama-3.3-70b model.
 *
 * Stages:
 *   1. requirementExtraction  — parse & enrich the user's idea
 *   2. architectureGeneration — produce the full technical blueprint
 *   3. suggestionGeneration   — creative improvements & alternatives
 *   4. memoryExtraction       — identify durable facts to retain
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const Groq = require('groq-sdk');

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile'; // free tier model

// ─────────────────────────────────────────────────────────────
// Shared helper — single Groq call returning parsed JSON
// ─────────────────────────────────────────────────────────────
async function callGroq(systemPrompt, userMessage, maxTokens = 4096) {
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content || '{}';

  // Strip any accidental markdown fences
  const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    return { _raw: clean };
  }
}

// ─────────────────────────────────────────────────────────────
// STAGE 1 — Requirement Extraction
// ─────────────────────────────────────────────────────────────
async function extractRequirements(idea, memorySummary) {
  const system = `
You are a senior requirements analyst with 15+ years of experience.
Your job is to analyse a software idea and extract structured requirements.
Always return ONLY valid JSON — no markdown, no preamble, no extra text.
`.trim();

  const user = `
## User's App Idea
${idea}

## Recalled Memory (user context & preferences)
${memorySummary || 'No prior memory available.'}

Extract and return JSON with this exact shape:
{
  "projectTitle": "short descriptive title",
  "projectSummary": "2-3 sentence executive summary",
  "userRoles": ["role1", "role2"],
  "functionalRequirements": ["FR1", "FR2"],
  "nonFunctionalRequirements": ["NFR1", "NFR2"],
  "inferredConstraints": ["constraint1"]
}
`.trim();

  return callGroq(system, user, 2048);
}

// ─────────────────────────────────────────────────────────────
// STAGE 2 — Architecture Generation
// ─────────────────────────────────────────────────────────────
async function generateArchitecture(idea, requirements, memorySummary) {
  const system = `
You are a principal full-stack architect with 15+ years of experience.
You design scalable, practical, implementation-ready systems.
Prioritise MVP clarity. Factor in the user's recalled preferences when choosing technology.
Always return ONLY valid JSON — no markdown, no preamble, no extra text.
`.trim();

  const user = `
## App Idea
${idea}

## Extracted Requirements
${JSON.stringify(requirements, null, 2)}

## User's Recalled Memory / Preferences
${memorySummary || 'No prior memory.'}

Return JSON with this exact shape:
{
  "coreFeatures": [
    { "name": "Feature Name", "description": "what it does", "priority": "must-have|should-have|nice-to-have" }
  ],
  "systemModules": [
    { "name": "Module Name", "responsibility": "what it owns", "techStack": "tech choices" }
  ],
  "architectureFlow": [
    "Step 1: User opens the app...",
    "Step 2: Frontend calls POST /api/...",
    "..."
  ],
  "databaseEntities": [
    {
      "entity": "EntityName",
      "fields": ["id", "field1 (type)", "field2 (type)"],
      "relationships": ["belongs to X", "has many Y"]
    }
  ],
  "apiEndpoints": [
    {
      "method": "POST",
      "path": "/api/example",
      "description": "what it does",
      "requestBody": "{ field: type }",
      "response": "{ field: type }"
    }
  ],
  "techStackSummary": "one paragraph describing chosen stack and rationale"
}
`.trim();

  return callGroq(system, user, 4096);
}

// ─────────────────────────────────────────────────────────────
// STAGE 3 — Suggestions + Roadmap + Deployment + Assembly
// ─────────────────────────────────────────────────────────────
async function generateSuggestionsAndPlans(idea, requirements, architecture, memorySummary) {
  const system = `
You are a senior product architect and startup advisor.
You give practical, opinionated advice that helps teams ship fast.
Think hackathon-ready, MVP-first, then scale.
Always return ONLY valid JSON — no markdown, no preamble, no extra text.
`.trim();

  const user = `
## App Idea
${idea}

## Requirements
${JSON.stringify(requirements, null, 2)}

## Architecture
${JSON.stringify(architecture, null, 2)}

## User's Recalled Preferences
${memorySummary || 'No prior memory.'}

Return JSON:
{
  "suggestedImprovements": [
    { "title": "Improvement", "rationale": "why", "effort": "low|medium|high" }
  ],
  "developmentPlan": [
    { "phase": "Phase 1 — MVP Core", "duration": "2 weeks", "tasks": ["task1", "task2"] }
  ],
  "deploymentPlan": [
    { "step": 1, "action": "Deploy database", "tool": "Railway / PlanetScale / RDS", "notes": "..." }
  ],
  "assemblyGuide": [
    "1. Clone repo and install dependencies: npm install",
    "2. Copy .env.example to .env and fill in keys",
    "3. Run MySQL schema",
    "4. Start Express backend: npm run dev",
    "5. Open frontend/index.html in browser or serve with npx serve"
  ]
}
`.trim();

  return callGroq(system, user, 3000);
}

// ─────────────────────────────────────────────────────────────
// STAGE 4 — Memory Extraction
// ─────────────────────────────────────────────────────────────
async function extractMemoriesToRetain(idea, fullReport) {
  const system = `
You are a memory extraction engine for a long-term AI memory system.
Your job is to identify durable, reusable facts about the user's preferences,
stack choices, project style, and constraints from this interaction.
These memories will be retrieved in future sessions to personalise future designs.
Always return ONLY valid JSON — no markdown, no preamble, no extra text.
`.trim();

  const user = `
## Original Idea
${idea}

## Generated Report (summary)
Project: ${fullReport.projectTitle || ''}
Stack: ${fullReport.techStackSummary || ''}
Deployment: ${JSON.stringify(fullReport.deploymentPlan || []).slice(0, 500)}
Constraints: ${JSON.stringify(fullReport.inferredConstraints || []).slice(0, 300)}

Extract 4–8 short durable memory facts.
Return JSON:
{
  "memories": [
    { "key": "preferred_backend", "value": "user prefers Express.js with Node 18+" },
    { "key": "deployment_preference", "value": "user prefers low-cost deployment (Railway/Vercel)" },
    { "key": "build_style", "value": "user values MVP-first with modular monolith" }
  ]
}
`.trim();

  const result = await callGroq(system, user, 1024);
  return result.memories || [];
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT — orchestrate all 4 stages
// ─────────────────────────────────────────────────────────────
async function generateDesignReport({ idea, memoryRecalled }) {
  const memorySummary = (memoryRecalled || [])
    .map(m => `- ${m.key}: ${m.value}`)
    .join('\n') || null;

  console.log('[LLM] Stage 1: Extracting requirements...');
  const requirements = await extractRequirements(idea, memorySummary);

  console.log('[LLM] Stage 2: Generating architecture...');
  const architecture = await generateArchitecture(idea, requirements, memorySummary);

  console.log('[LLM] Stage 3: Generating suggestions and plans...');
  const plans = await generateSuggestionsAndPlans(idea, requirements, architecture, memorySummary);

  const fullReport = {
    projectTitle: requirements.projectTitle || 'Untitled Project',
    projectSummary: requirements.projectSummary || '',
    userRoles: requirements.userRoles || [],
    functionalRequirements: requirements.functionalRequirements || [],
    nonFunctionalRequirements: requirements.nonFunctionalRequirements || [],
    inferredConstraints: requirements.inferredConstraints || [],
    coreFeatures: architecture.coreFeatures || [],
    systemModules: architecture.systemModules || [],
    architectureFlow: architecture.architectureFlow || [],
    databaseEntities: architecture.databaseEntities || [],
    apiEndpoints: architecture.apiEndpoints || [],
    techStackSummary: architecture.techStackSummary || '',
    suggestedImprovements: plans.suggestedImprovements || [],
    developmentPlan: plans.developmentPlan || [],
    deploymentPlan: plans.deploymentPlan || [],
    assemblyGuide: plans.assemblyGuide || [],
  };

  console.log('[LLM] Stage 4: Extracting memories to retain...');
  const memoryLearned = await extractMemoriesToRetain(idea, fullReport);

  return { report: fullReport, memoryLearned };
}

module.exports = { generateDesignReport };

// Parses an a.EYE leaderboard submission out of a GitHub issue body, validates
// it, and appends it to leaderboard.json. Emits result/message to $GITHUB_OUTPUT
// so the workflow can comment + label. Auto-ingests (verified:false) for
// after-the-fact review.
//
// Env in: ISSUE_BODY, ISSUE_NUMBER, ISSUE_AUTHOR
// Node 20+ (available on GitHub runners). No dependencies.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Stable, non-reversible handle from a GitHub login — the public board never
// stores real usernames. Same user → same handle (for grouping). The real
// submitter remains visible to the maintainer via the linked source issue.
function anonHandle(login) {
  const h = createHash("sha256").update(String(login || "anon")).digest("hex");
  return "anon-" + h.slice(0, 6);
}

const DATA = "leaderboard.json";
const RUNTIMES = new Set(["GGUF", "MLX"]);

function out(result, message) {
  const gh = process.env.GITHUB_OUTPUT;
  if (gh) {
    appendFileSync(gh, `result=${result}\n`);
    appendFileSync(gh, `message<<EOF\n${message}\nEOF\n`);
  }
  console.log(`[ingest] ${result}: ${message}`);
}

function extractJSON(body) {
  // Prefer a fenced ```json block; fall back to the first {...} object.
  const fenced = body.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const brace = body.match(/\{[\s\S]*\}/);
  return brace ? brace[0] : null;
}

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function validate(e) {
  const errs = [];
  const str = (k, max = 200) =>
    typeof e[k] === "string" && e[k].trim().length > 0 && e[k].length <= max;

  if (!str("model")) errs.push("model");
  if (!(typeof e.runtime === "string" && RUNTIMES.has(e.runtime))) errs.push("runtime (GGUF|MLX)");
  if (!str("suiteVersion", 20)) errs.push("suiteVersion");
  if (!(Number.isInteger(e.quality) && e.quality >= 0 && e.quality <= 100)) errs.push("quality 0..100");
  if (!(isFiniteNumber(e.tokensPerSecond) && e.tokensPerSecond >= 0 && e.tokensPerSecond < 100000)) errs.push("tokensPerSecond");
  if (!(isFiniteNumber(e.energyJoules) && e.energyJoules >= 0)) errs.push("energyJoules");
  if (!(isFiniteNumber(e.qualityPerKilojoule) && e.qualityPerKilojoule >= 0)) errs.push("qualityPerKilojoule");
  if (!(isFiniteNumber(e.tokensPerJoule) && e.tokensPerJoule >= 0)) errs.push("tokensPerJoule");
  if (!str("chip", 100)) errs.push("chip");
  if (!(Number.isInteger(e.memoryGB) && e.memoryGB > 0 && e.memoryGB < 8192)) errs.push("memoryGB");
  if (!str("appVersion", 40)) errs.push("appVersion");
  return errs;
}

const body = process.env.ISSUE_BODY || "";
const issue = Number(process.env.ISSUE_NUMBER || 0);
const author = process.env.ISSUE_AUTHOR || "unknown";

const raw = extractJSON(body);
if (!raw) {
  // Not a submission — stay silent so ordinary issues aren't spammed.
  out("skip", "No JSON submission block found.");
  process.exit(0);
}

let entry;
try {
  entry = JSON.parse(raw);
} catch (err) {
  out("invalid", `Could not parse the JSON block: ${err.message}`);
  process.exit(0);
}

const errs = validate(entry);
if (errs.length) {
  out("invalid", `Submission rejected — invalid/missing fields: ${errs.join(", ")}.`);
  process.exit(0);
}

// Normalize + tag for traceability and later verification.
const clean = {
  id: typeof entry.id === "string" ? entry.id : `${issue}-${Date.now()}`,
  model: entry.model.trim(),
  runtime: entry.runtime,
  suiteVersion: entry.suiteVersion.trim(),
  quality: entry.quality,
  tokensPerSecond: entry.tokensPerSecond,
  energyJoules: entry.energyJoules,
  qualityPerKilojoule: entry.qualityPerKilojoule,
  tokensPerJoule: entry.tokensPerJoule,
  chip: entry.chip.trim(),
  memoryGB: entry.memoryGB,
  appVersion: entry.appVersion.trim(),
  date: typeof entry.date === "string" ? entry.date : new Date().toISOString(),
  official: entry.official === true,
  // Ingestion metadata (ignored by the app's decoder):
  sourceIssue: issue,          // maintainer can trace real submitter via the issue
  submittedBy: anonHandle(author),
  verified: false,
  ingestedAt: new Date().toISOString(),
};

let list = [];
try {
  list = JSON.parse(readFileSync(DATA, "utf8"));
  if (!Array.isArray(list)) list = [];
} catch {
  list = [];
}

const existing = list.findIndex((x) => x.id === clean.id);
if (existing >= 0) list[existing] = clean; // idempotent re-edit of the same submission
else list.push(clean);

writeFileSync(DATA, JSON.stringify(list, null, 2) + "\n");
out("added", `Added **${clean.model}** (${clean.runtime}) on ${clean.chip} — quality ${clean.quality}, ${clean.qualityPerKilojoule.toFixed(1)} q/kJ. Marked unverified for review.`);

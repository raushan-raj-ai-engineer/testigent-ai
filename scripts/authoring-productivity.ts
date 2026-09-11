import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';

interface ActiveSession {
  requirementId: string;
  mode: string;
  startedAt: string;
  application: string;
  environment: string;
}
interface CompletedSession extends ActiveSession {
  completedAt: string;
  elapsedMinutes: number;
  manualBaselineMinutes?: number;
  estimatedMinutesSaved?: number;
  estimatedSavingsPercent?: number;
}

const command = (process.argv[2] ?? 'report').toLowerCase();
const requirementId = process.argv[3];
const mode = (process.argv[4] ?? process.env.AUTHORING_MODE ?? 'agents').toLowerCase();
const target = WorkspaceContext.resolve();
const app = target.application;
const runtimeDir = path.resolve('.runtime', 'authoring');
const reportDir = path.resolve('reports', app, 'productivity');
const eventsFile = path.join(reportDir, 'authoring-events.jsonl');

if (command === 'start') {
  if (!requirementId) throw new Error('Usage: npm run authoring:start -- <requirementId> [agents|mcp|cli|manual]');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const session: ActiveSession = { requirementId, mode, startedAt: new Date().toISOString(), application: app, environment: target.environment };
  fs.writeFileSync(path.join(runtimeDir, `${safe(requirementId)}.json`), JSON.stringify(session, null, 2));
  console.log(`[authoring] started requirement=${requirementId} mode=${mode}`);
} else if (command === 'complete') {
  if (!requirementId) throw new Error('Usage: npm run authoring:complete -- <requirementId>');
  const stateFile = path.join(runtimeDir, `${safe(requirementId)}.json`);
  if (!fs.existsSync(stateFile)) throw new Error(`No active authoring session for '${requirementId}'.`);
  const active = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as ActiveSession;
  const completedAt = new Date();
  const elapsedMinutes = round((completedAt.getTime() - new Date(active.startedAt).getTime()) / 60000);
  const baselineRaw = Number(process.env.AUTHORING_MANUAL_BASELINE_MINUTES ?? 0);
  const baseline = Number.isFinite(baselineRaw) && baselineRaw > 0 ? baselineRaw : undefined;
  const saved = baseline === undefined ? undefined : round(Math.max(0, baseline - elapsedMinutes));
  const percent = baseline === undefined ? undefined : round((Math.max(0, baseline - elapsedMinutes) / baseline) * 100);
  const record: CompletedSession = { ...active, completedAt: completedAt.toISOString(), elapsedMinutes, manualBaselineMinutes: baseline, estimatedMinutesSaved: saved, estimatedSavingsPercent: percent };
  fs.mkdirSync(reportDir, { recursive: true });
  fs.appendFileSync(eventsFile, `${JSON.stringify(record)}\n`);
  fs.rmSync(stateFile, { force: true });
  writeReport(readEvents());
  console.log(`[authoring] completed requirement=${requirementId} elapsedMinutes=${elapsedMinutes}${baseline ? ` estimatedSavings=${percent}%` : ''}`);
} else if (command === 'report') {
  writeReport(readEvents());
} else {
  throw new Error(`Unknown authoring productivity command '${command}'. Use start, complete or report.`);
}

function readEvents(): CompletedSession[] {
  if (!fs.existsSync(eventsFile)) return [];
  return fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line) as CompletedSession]; } catch { return []; }
  });
}

function writeReport(events: CompletedSession[]): void {
  fs.mkdirSync(reportDir, { recursive: true });
  const totalElapsed = round(events.reduce((sum, item) => sum + item.elapsedMinutes, 0));
  const withBaseline = events.filter(item => item.manualBaselineMinutes !== undefined);
  const totalBaseline = round(withBaseline.reduce((sum, item) => sum + (item.manualBaselineMinutes ?? 0), 0));
  const estimatedSaved = round(withBaseline.reduce((sum, item) => sum + (item.estimatedMinutesSaved ?? 0), 0));
  const summary = {
    generatedAt: new Date().toISOString(),
    application: app,
    completedAuthoringSessions: events.length,
    measuredAutomationMinutes: totalElapsed,
    baselineBackedSessions: withBaseline.length,
    configuredManualBaselineMinutes: totalBaseline,
    estimatedMinutesSaved: estimatedSaved,
    estimatedSavingsPercent: totalBaseline > 0 ? round((estimatedSaved / totalBaseline) * 100) : undefined,
    note: 'Savings are estimates only when AUTHORING_MANUAL_BASELINE_MINUTES is supplied by the team; elapsed authoring time is measured.'
  };
  fs.writeFileSync(path.join(reportDir, 'authoring-productivity.json'), JSON.stringify({ summary, events }, null, 2));
  const rows = events.length ? events.map(item => `| ${item.requirementId} | ${item.mode} | ${item.elapsedMinutes} | ${item.manualBaselineMinutes ?? '—'} | ${item.estimatedMinutesSaved ?? '—'} | ${item.estimatedSavingsPercent === undefined ? '—' : `${item.estimatedSavingsPercent}%`} |`).join('\n') : '| — | — | — | — | — | — |';
  fs.writeFileSync(path.join(reportDir, 'authoring-productivity.md'), `# Test Authoring Productivity\n\nMeasured authoring time is factual. Savings are shown only when the team supplies a manual baseline.\n\n| Requirement | Mode | Measured minutes | Manual baseline | Estimated saved | Estimated saving |\n|---|---:|---:|---:|---:|---:|\n${rows}\n\n## Summary\n\n- Completed sessions: ${summary.completedAuthoringSessions}\n- Measured authoring minutes: ${summary.measuredAutomationMinutes}\n- Baseline-backed sessions: ${summary.baselineBackedSessions}\n- Estimated minutes saved: ${summary.estimatedMinutesSaved}\n- Estimated savings percent: ${summary.estimatedSavingsPercent === undefined ? 'Not calculated' : `${summary.estimatedSavingsPercent}%`}\n`, 'utf8');
  console.log(`[authoring] report=${path.join(reportDir, 'authoring-productivity.md')}`);
}

function safe(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, '-'); }
function round(value: number): number { return Math.round(value * 100) / 100; }

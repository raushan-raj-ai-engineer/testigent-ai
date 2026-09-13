import 'dotenv/config';
import { resolveProviderOrder } from '../src/framework/ai/ai-provider.factory';

/**
 * Author: Raushan Raj
 * Business Use: Performs deterministic configuration/policy validation for the live AI provider canary without making a network call.
 * How to use: CI runs `npm run ai:canary:preflight` before provider health/generation checks.
 * Benefit: Misconfiguration is distinguished from external provider degradation and the same policy works in GitHub and Azure.
 */
export function validateAiCanaryConfiguration(): string[] {
  requireTrue('AI_ENABLED');
  requireTrue('ALLOW_AI_TESTS');
  requireTrue('HEALING_AI_ENABLED');
  const attemptMs = positiveInteger('AI_TIMEOUT_MS', 30_000);
  const totalMs = positiveInteger('AI_TOTAL_TIMEOUT_MS', 90_000);
  if (totalMs < attemptMs) throw new Error('AI_TOTAL_TIMEOUT_MS must be >= AI_TIMEOUT_MS.');
  const attempts = positiveInteger('AI_RETRY_MAX_ATTEMPTS', 3);
  if (attempts < 1 || attempts > 5) throw new Error('AI_RETRY_MAX_ATTEMPTS must be between 1 and 5.');
  const baseDelay = nonNegativeInteger('AI_RETRY_BASE_DELAY_MS', 1_000);
  const maxDelay = nonNegativeInteger('AI_RETRY_MAX_DELAY_MS', 8_000);
  if (maxDelay < baseDelay) throw new Error('AI_RETRY_MAX_DELAY_MS must be >= AI_RETRY_BASE_DELAY_MS.');
  nonNegativeInteger('AI_RETRY_JITTER_MS', 250);
  booleanValue('AI_RETRY_ON_TIMEOUT', true);
  const testTimeout = positiveInteger('TEST_TIMEOUT_MS', 180_000);
  if (testTimeout <= totalMs) throw new Error('TEST_TIMEOUT_MS must be greater than AI_TOTAL_TIMEOUT_MS.');

  const providers = resolveProviderOrder();
  if (!providers.length) throw new Error('No configured AI provider resolved for live canary.');
  if (providers.includes('gemini')) {
    const thinking = (process.env.GEMINI_THINKING_LEVEL ?? 'low').trim();
    if (!['low', 'medium', 'high'].includes(thinking)) throw new Error('GEMINI_THINKING_LEVEL must be low, medium or high.');
    if (positiveInteger('GEMINI_MAX_OUTPUT_TOKENS', 512) < 64) throw new Error('GEMINI_MAX_OUTPUT_TOKENS must be >= 64.');
  }
  return providers;
}

function requireTrue(name: string): void { if ((process.env[name] ?? '').trim().toLowerCase() !== 'true') throw new Error(`${name} must be true in the live AI canary.`); }
function positiveInteger(name: string, fallback: number): number { const raw = process.env[name]?.trim(); const value = raw ? Number(raw) : fallback; if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`); return value; }
function nonNegativeInteger(name: string, fallback: number): number { const raw = process.env[name]?.trim(); const value = raw ? Number(raw) : fallback; if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`); return value; }
function booleanValue(name: string, fallback: boolean): boolean { const raw = (process.env[name] ?? String(fallback)).trim().toLowerCase(); if (raw !== 'true' && raw !== 'false') throw new Error(`${name} must be true or false.`); return raw === 'true'; }

if (require.main === module) {
  try {
    const providers = validateAiCanaryConfiguration();
    console.log(`[ai:canary:preflight] PASS providers=${providers.join(' -> ')}`);
  } catch (error) {
    console.error(`[ai:canary:preflight] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

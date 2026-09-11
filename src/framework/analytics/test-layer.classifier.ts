import path from 'node:path';
import type { TestLayer, TestType } from './report.types';

/**
 * Author: Raushan Raj
 * Business Use: Categorizes tests into UI/API/Database layers and mixed business test types for dashboard filtering.
 * How to use: Reporter passes tags + source file to classifyTestLayers(). Prefer explicit @ui/@api/@db tags for accuracy.
 * Benefit: Business can see whether risk is isolated to UI, service, database, or a cross-layer journey.
 */
export function classifyTestLayers(tags: string[], sourceFile?: string): { layers: TestLayer[]; testType: TestType } {
  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const normalizedPath = (sourceFile ? path.normalize(sourceFile) : '').toLowerCase();
  const layers = new Set<TestLayer>();

  if (normalizedTags.includes('@ui') || /(^|[\\/_.-])ui([\\/_.-]|$)/.test(normalizedPath)) layers.add('UI');
  if (normalizedTags.includes('@api') || /(^|[\\/_.-])api([\\/_.-]|$)/.test(normalizedPath)) layers.add('API');
  if (normalizedTags.includes('@db') || normalizedTags.includes('@database') || /(^|[\\/_.-])(db|database)([\\/_.-]|$)/.test(normalizedPath)) layers.add('DATABASE');

  // E2E specs often intentionally span multiple layers; filenames such as ui-api-db make that explicit.
  if (normalizedTags.includes('@e2e') || normalizedPath.includes(`${path.sep}e2e${path.sep}`)) {
    if (normalizedPath.includes('ui')) layers.add('UI');
    if (normalizedPath.includes('api')) layers.add('API');
    if (normalizedPath.includes('db') || normalizedPath.includes('database')) layers.add('DATABASE');
  }

  const ordered = (['UI', 'API', 'DATABASE'] as TestLayer[]).filter(layer => layers.has(layer));
  return { layers: ordered, testType: toTestType(ordered) };
}

/**
 * Reusable framework function `toTestType`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function toTestType(layers: TestLayer[]): TestType {
  const has = (layer: TestLayer) => layers.includes(layer);
  if (has('UI') && has('API') && has('DATABASE')) return 'UI_API_DATABASE';
  if (has('UI') && has('API')) return 'UI_API';
  if (has('UI') && has('DATABASE')) return 'UI_DATABASE';
  if (has('API') && has('DATABASE')) return 'API_DATABASE';
  if (has('UI')) return 'UI_ONLY';
  if (has('API')) return 'API_ONLY';
  if (has('DATABASE')) return 'DATABASE_ONLY';
  return 'OTHER';
}

/**
 * Reusable framework function `formatTestType`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function formatTestType(type: TestType): string {
  return ({
    UI_ONLY: 'UI only',
    API_ONLY: 'API only',
    DATABASE_ONLY: 'Database only',
    UI_API: 'UI + API',
    UI_DATABASE: 'UI + Database',
    API_DATABASE: 'API + Database',
    UI_API_DATABASE: 'UI + API + Database',
    OTHER: 'Other'
  } satisfies Record<TestType, string>)[type];
}

import fs from 'node:fs';
import path from 'node:path';
import type { BusinessImpactFact, BusinessTestResult } from './report.types';

interface ImpactConfigEntry { area: string; impact: string; priority: BusinessImpactFact['priority']; }

/**
 * Author: Raushan Raj
 * Business Use: Converts failed tagged journeys into deterministic business-impact facts from an organization-owned mapping.
 * How to use: Maintain config/business-impact.json and tag business tests such as @critical, @payment or @login.
 * Benefit: AI does not invent business impact; product owners define the approved impact language once and reuse it across reports.
 */
export function buildBusinessImpacts(results: BusinessTestResult[], configPath = path.resolve('config/business-impact.json')): BusinessImpactFact[] {
  if (!fs.existsSync(configPath)) return [];
  let config: Record<string, ImpactConfigEntry> = {};
  try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, ImpactConfigEntry>; }
  catch { return []; }
  const impacts: BusinessImpactFact[] = [];
  for (const [tag, definition] of Object.entries(config)) {
    const affected = results.filter(result => result.status === 'failed' && result.tags.includes(tag));
    if (!affected.length) continue;
    impacts.push({
      tag,
      area: definition.area,
      impact: definition.impact,
      priority: definition.priority,
      affectedTests: affected.length,
      testTitles: affected.map(result => result.title)
    });
  }
  return impacts.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || b.affectedTests - a.affectedTests);
}

function priorityRank(value: BusinessImpactFact['priority']): number {
  return value === 'HIGH' ? 3 : value === 'MEDIUM' ? 2 : 1;
}

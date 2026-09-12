import { HealingCache } from '../../src/framework/healing/healing.cache';
import type { LocatorPlan } from '../../src/framework/healing/healing.types';

const [file, id, name] = process.argv.slice(2);
if (!file || !id || !name) throw new Error('Usage: healing-cache-writer <file> <planId> <buttonName>');
process.env.APP = process.env.APP ?? 'demo';
process.env.ENV = process.env.ENV ?? 'qa';
const plan: LocatorPlan = { id, businessName: name, primary: { type: 'role', role: 'button', name } };
new HealingCache(file).set(plan, {
  descriptor: { type: 'role', role: 'button', name: `${name} recovered` },
  source: 'ai', confidence: 0.99, reason: 'concurrency contract'
}, 'synthetic semantic verification');

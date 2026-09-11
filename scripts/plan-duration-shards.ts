import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { balanceByDuration, keyFromTestListLine } from '../src/framework/execution/duration-balancer';
import { DurationHistoryStore } from '../src/framework/execution/duration-history.store';

interface PlannerArgs { shards: number; outputDir: string; playwrightArgs: string[]; }

/**
 * Creates optional duration-aware Playwright `--test-list` files.
 * Native `--shard=x/y` remains the framework default; use this only when measured shard imbalance justifies it.
 */
function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const list = spawnSync('npx', ['playwright', 'test', ...args.playwrightArgs, '--list'], {
    encoding: 'utf8', env: process.env, shell: process.platform === 'win32',
  });
  if (list.status !== 0) throw new Error(`Playwright --list failed:\n${list.stderr || list.stdout}`);

  const history = new DurationHistoryStore();
  const lines = String(list.stdout).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const items = lines.flatMap(line => {
    const key = keyFromTestListLine(line);
    return key ? [{ key, testListLine: line, estimatedMs: history.estimateMs(key) }] : [];
  });
  if (!items.length) throw new Error('No Playwright test-list entries were detected.');

  const shards = balanceByDuration(items, args.shards);
  fs.mkdirSync(args.outputDir, { recursive: true });
  for (const shard of shards) {
    const file = path.join(args.outputDir, `shard-${shard.index}-of-${args.shards}.txt`);
    fs.writeFileSync(file, `# Estimated ${Math.round(shard.estimatedMs / 1000)}s\n${shard.items.map(item => item.testListLine).join('\n')}\n`);
    console.log(`${file}: ${shard.items.length} tests, ~${Math.round(shard.estimatedMs / 1000)}s`);
  }
  console.log('Run each file in a separate CI job with: npx playwright test --test-list <file>');
  console.log('Note: Playwright documents test-list execution as best-effort; native --shard remains the safe default.');
}

function parseArgs(argv: string[]): PlannerArgs {
  let shards = 0;
  let outputDir = path.resolve('.runtime/test-lists');
  const playwrightArgs: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--shards=')) { shards = Number(arg.slice('--shards='.length)); continue; }
    if (arg === '--shards') { shards = Number(argv[++index]); continue; }
    if (arg.startsWith('--output=')) { outputDir = path.resolve(arg.slice('--output='.length)); continue; }
    if (arg === '--output') { outputDir = path.resolve(argv[++index] ?? ''); continue; }
    playwrightArgs.push(arg);
  }
  if (!Number.isInteger(shards) || shards < 2) throw new Error('Usage: npm run execution:plan-duration -- --shards <2+> [playwright args]');
  return { shards, outputDir, playwrightArgs };
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }

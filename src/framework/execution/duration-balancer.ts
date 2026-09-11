export interface DurationPlanItem {
  key: string;
  testListLine: string;
  estimatedMs: number;
}

export interface DurationShard {
  index: number;
  estimatedMs: number;
  items: DurationPlanItem[];
}

/**
 * Greedy longest-processing-time shard planner.
 * It is intentionally opt-in because Playwright test-list execution is documented as best-effort.
 */
export function balanceByDuration(items: DurationPlanItem[], shardCount: number): DurationShard[] {
  if (!Number.isInteger(shardCount) || shardCount < 1) throw new Error('shardCount must be a positive integer.');
  for (const item of items) {
    if (!item.key.trim() || !item.testListLine.trim()) throw new Error('Duration plan items require key and testListLine.');
    if (!Number.isFinite(item.estimatedMs) || item.estimatedMs < 0) {
      throw new Error(`Duration estimate for '${item.key}' must be a finite non-negative number.`);
    }
  }
  const shards: DurationShard[] = Array.from({ length: shardCount }, (_, index) => ({ index: index + 1, estimatedMs: 0, items: [] }));
  const ordered = [...items].sort((a, b) => b.estimatedMs - a.estimatedMs || a.key.localeCompare(b.key));
  for (const item of ordered) {
    const shard = [...shards].sort((a, b) => a.estimatedMs - b.estimatedMs || a.index - b.index)[0];
    if (!shard) throw new Error('Duration planner has no target shard.');
    shard.items.push(item);
    shard.estimatedMs += Math.max(0, item.estimatedMs);
  }
  return shards;
}

/** Extracts the stable file-location key from a Playwright `--list` line. */
export function keyFromTestListLine(line: string): string | undefined {
  const normalized = line.trim();
  const match = normalized.match(/(?:^|›|>)\s*([^›>]+?\.spec\.[cm]?[jt]s):(\d+):(\d+)/i);
  if (!match) return undefined;
  return `${match[1]!.trim().replace(/\\/g, '/')}:${match[2]}:${match[3]}`;
}

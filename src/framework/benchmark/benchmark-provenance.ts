import type { BenchmarkProvenance } from './benchmark.types.js';

/** Returns true only when benchmark evidence carries enough immutable context to support a product claim. */
export function hasCompleteBenchmarkProvenance(value: BenchmarkProvenance): boolean {
  return Boolean(
    value.productVersion.trim() &&
    /^[0-9a-f]{7,64}$/i.test(value.commit.trim()) &&
    value.runtime.trim() &&
    value.platform.trim() &&
    value.environmentDescription.trim() &&
    value.methodology.trim() &&
    value.evidenceRef.trim() &&
    !value.evidenceRef.startsWith('synthetic:') &&
    /^[0-9a-f]{64}$/i.test(value.evidenceSha256.trim()),
  );
}

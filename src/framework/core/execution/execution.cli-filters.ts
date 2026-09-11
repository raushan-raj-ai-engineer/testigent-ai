/**
 * Merges user Playwright grep options with mandatory TestigentAI execution policy.
 * User include filters are ANDed with mandatory profile/lane filters, while user invert
 * filters are ORed with mandatory exclusions so command-line convenience cannot bypass governance.
 */
export function mergeGovernedFilters(args: string[], enforcedGrep?: RegExp, enforcedGrepInvert?: RegExp): string[] {
  const passthrough: string[] = [];
  const userGreps: string[] = [];
  const userInverts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg.startsWith('--grep=')) { userGreps.push(requirePattern('--grep', arg.slice('--grep='.length))); continue; }
    if (arg === '--grep' || arg === '-g') { userGreps.push(requirePattern(arg, args[++index])); continue; }
    if (arg.startsWith('--grep-invert=')) { userInverts.push(requirePattern('--grep-invert', arg.slice('--grep-invert='.length))); continue; }
    if (arg === '--grep-invert') { userInverts.push(requirePattern(arg, args[++index])); continue; }
    passthrough.push(arg);
  }

  const userGrepConstraint = userGreps.map(pattern => `(?=.*(?:${pattern}))`).join('');
  const combinedGrep = `${userGrepConstraint}${enforcedGrep?.source ?? ''}`;
  if (combinedGrep) passthrough.push('--grep', combinedGrep);

  const invertParts = [
    ...userInverts.map(pattern => `(?:${pattern})`),
    ...(enforcedGrepInvert ? [`(?:${enforcedGrepInvert.source})`] : []),
  ];
  if (invertParts.length) passthrough.push('--grep-invert', invertParts.join('|'));
  return passthrough;
}

function requirePattern(flag: string, value: string | undefined): string {
  if (!value) throw new Error(`${flag} requires a regular-expression value.`);
  try { new RegExp(value); } catch (error) {
    throw new Error(`${flag} received an invalid regular expression '${value}': ${error instanceof Error ? error.message : String(error)}`);
  }
  return value;
}

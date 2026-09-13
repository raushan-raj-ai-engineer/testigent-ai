/**
 * Normalize text before structural release-policy checks so Git checkout
 * line-ending conversion cannot change the result across operating systems.
 */
export function normalizeContractText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

/**
 * The merged-report step is informational: it must always run, must never
 * block the workflow, and must publish through the dedicated summary script.
 */
export function hasInformationalBusinessSummaryContract(value) {
  const text = normalizeContractText(value);
  return /continue-on-error:\s*true\n\s*shell:\s*bash\n\s*run:\s*npm run --silent ci:business:summary >> "\$GITHUB_STEP_SUMMARY"/.test(text);
}

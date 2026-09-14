/**
 * Normalize text before structural release-policy checks so Git checkout
 * line-ending conversion cannot change the result across operating systems.
 */
export function normalizeContractText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

/**
 * Validate v1.9.2 review metadata independently of checkout line endings.
 */
export function hasReviewMetadataContract(
  value,
  {
    version = '1.9.2',
    certifiedBaselineSha = '38e2406c73608cabcf42a8ff0ea8e35e745dea23'
  } = {}
) {
  const text = normalizeContractText(value);

  return (
    text.includes(`Candidate version:\n${version}`) &&
    text.includes(certifiedBaselineSha)
  );
}

/**
 * The merged-report step is informational: it must always run, must never
 * block the workflow, and must publish through the dedicated summary script.
 */
export function hasInformationalBusinessSummaryContract(value) {
  const text = normalizeContractText(value);
  return /continue-on-error:\s*true\n\s*shell:\s*bash\n\s*run:\s*npm run --silent ci:business:summary >> "\$GITHUB_STEP_SUMMARY"/.test(text);
}

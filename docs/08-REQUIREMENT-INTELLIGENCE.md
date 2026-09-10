# Requirement Intelligence and Application Knowledge

Requirement intelligence resolves the target project, discovers reusable abstractions, creates a test plan and may scaffold a review-blocked proposal under the selected project’s ownership model.

Approved application knowledge may inform generation. New or changed observations return to review-required status so stale evidence cannot silently influence automation.

External connectors (Jira, Azure Boards, GitHub Issues) normalize requirements into a common model. Reads may retry transient failures; write-back defaults to disabled/dry-run and requires explicit enablement.

Promotion must never overwrite human-owned active tests without safeguards. Any proposal file change after approval invalidates the approval hash and requires review again.

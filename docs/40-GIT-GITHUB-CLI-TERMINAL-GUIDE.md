# Git and GitHub CLI Terminal Guide

This is the day-to-day terminal guide for TestigentAI contributors. It covers Git and GitHub CLI (`gh`) from first-time installation through feature branches, pull requests, CI monitoring, reruns, releases, tags, cleanup and common recovery commands.

> Safe default: do normal work on a feature branch. Keep `main` protected, pull before branching, and do not rewrite published release tags.

## 1. First-time installation

### macOS

Install Homebrew if your machine does not already have it, then install Git and GitHub CLI:

```bash
brew install git gh
```

Verify:

```bash
git --version
gh --version
```

### Windows

With Windows Package Manager:

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
```

Verify:

```powershell
git --version
gh --version
```

### Ubuntu / Debian

Install Git:

```bash
sudo apt update
sudo apt install -y git curl
```

Install GitHub CLI from GitHub's official APT repository:

```bash
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
sudo mkdir -p -m 755 /etc/apt/sources.list.d
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install -y gh
```

Verify:

```bash
gh --version
```

When upgrading an older Linux installation, refresh the official GitHub CLI keyring/repository instructions first; GitHub rotated its Linux package signing key in September 2026.

## 2. One-time Git identity configuration

Set the identity that will appear on your commits:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Check it:

```bash
git config --global --list
```

Useful optional defaults:

```bash
git config --global init.defaultBranch main
git config --global pull.ff only
```

`pull.ff only` prevents `git pull` from creating an accidental merge commit when the local branch has diverged. Resolve divergence intentionally instead.

## 3. Authenticate GitHub CLI

Login once:

```bash
gh auth login
```

Recommended interactive choices for this repository:

```text
GitHub.com
HTTPS
Login with a web browser
```

Verify the active account and token scopes:

```bash
gh auth status
```

Configure Git to use GitHub CLI as its credential helper for authenticated GitHub hosts:

```bash
gh auth setup-git
```

Useful GitHub CLI scopes for this project include repository access and workflow access. Do not paste tokens into source files, shell scripts, documentation or chat logs.

## 4. Clone and open the repository

Clone using GitHub CLI:

```bash
gh repo clone raushan-raj-ai-engineer/testigent-ai
cd testigent-ai
```

Or with Git:

```bash
git clone https://github.com/raushan-raj-ai-engineer/testigent-ai.git
cd testigent-ai
```

Confirm repository state:

```bash
git status
git remote -v
git branch -vv
```

## 5. Daily start-of-work sequence

Start from a synchronized `main`:

```bash
git checkout main
git pull origin main
git status -sb
```

Create a feature branch:

```bash
git checkout -b feature/<short-description>
```

Examples:

```bash
git checkout -b feature/payment-api-tests
git checkout -b fix/report-merge-validation
git checkout -b docs/git-gh-terminal-guide
```

Confirm:

```bash
git branch --show-current
git status
```

## 6. Inspect changes before commit

Frequently use:

```bash
git status
git diff
git diff --stat
git diff --check
```

`git diff --check` is important before commit because it catches whitespace problems that can fail quality gates.

Inspect staged changes separately:

```bash
git diff --cached
```

## 7. Stage and commit

Stage selected files:

```bash
git add path/to/file1 path/to/file2
```

Stage all intended changes:

```bash
git add .
```

Always review what is staged:

```bash
git status
git diff --cached --stat
```

Commit:

```bash
git commit -m "fix: harden report merge validation"
```

Common commit prefixes used by the project:

```text
feat:     new capability
fix:      defect correction
docs:     documentation only
refactor: structural change without intended behavior change
test:     test-only change
chore:    maintenance/build/tooling
release:  release preparation/hardening
```

## 8. Push a feature branch

First push:

```bash
git push -u origin <branch-name>
```

Example:

```bash
git push -u origin feature/v1.5.3-windows-static-portability
```

After upstream is configured:

```bash
git push
```

Check branch tracking:

```bash
git branch -vv
```

## 9. Create and inspect a pull request with `gh`

Create a PR interactively:

```bash
gh pr create \
  --base main \
  --head <feature-branch> \
  --title "Short PR title"
```

Useful PR commands:

```bash
gh pr status
gh pr view
gh pr view --web
gh pr checks
gh pr checks --watch
```

For a known PR number:

```bash
gh pr view 10
gh pr checks 10 --watch
```

## 10. Merge a pull request

Only merge after required checks are green:

```bash
gh pr merge <PR_NUMBER> --merge
```

Then synchronize local `main`:

```bash
git checkout main
git pull origin main
git status -sb
```

Confirm the merge:

```bash
git log -1 --oneline --decorate
node -p "require('./package.json').version"
```

## 11. Inspect Git history

Useful commands:

```bash
git log --oneline -10
git log --oneline --decorate --graph --all -20
git show HEAD
git show --stat HEAD
```

See which commit a branch/tag points to:

```bash
git rev-parse HEAD
git rev-parse main
git rev-parse v1.5.3^{commit}
```

## 12. GitHub Actions workflows

List workflows:

```bash
gh workflow list
```

Recent runs:

```bash
gh run list --limit 10
```

Main-branch TestigentAI CI:

```bash
gh run list \
  --branch main \
  --workflow playwright-sharded.yml \
  --limit 5
```

Release compatibility runs:

```bash
gh run list \
  --workflow release-compatibility.yml \
  --limit 5
```

Watch a run:

```bash
gh run watch <RUN_ID>
```

View job summary:

```bash
gh run view <RUN_ID>
```

View only failed logs:

```bash
gh run view <RUN_ID> --log-failed
```

View a particular job:

```bash
gh run view <RUN_ID> --job <JOB_ID> --log-failed
```

## 13. Rerun CI safely

Rerun only failed jobs:

```bash
gh run rerun <RUN_ID> --failed
```

Rerun the complete workflow:

```bash
gh run rerun <RUN_ID>
```

Watch the same run ID:

```bash
gh run watch <RUN_ID>
```

TestigentAI v1.5.2+ scopes CI artifacts with:

```text
github.run_id-github.run_attempt
```

so rerun attempt artifacts cannot be silently merged with a previous attempt. `Validate downloaded report bundles` must pass before final business aggregation.

## 14. Repository variables and secrets

List repository variables:

```bash
gh variable list
```

Read a variable:

```bash
gh variable get AI_ALLOWED_EXTERNAL_ORIGINS
```

Set/update a variable:

```bash
gh variable set AI_ALLOWED_EXTERNAL_ORIGINS \
  --body "https://generativelanguage.googleapis.com"
```

List secret names without exposing secret values:

```bash
gh secret list
```

Create/update a secret interactively or from secure input:

```bash
gh secret set GEMINI_API_KEY
```

Never echo secret values to logs.

## 15. TestigentAI release flow

Recommended sequence:

```text
feature branch
  -> local npm run validate:final
  -> push
  -> PR checks PASS
  -> merge
  -> main CI PASS
  -> create immutable version tag
  -> tag-triggered Release Compatibility PASS
```

After merge, verify main:

```bash
git checkout main
git pull origin main
git status -sb
node -p "require('./package.json').version"
```

Monitor main CI:

```bash
gh run list --branch main --workflow playwright-sharded.yml --limit 5
```

Create an annotated release tag only after main CI passes:

```bash
git tag -a vX.Y.Z -m "TestigentAI vX.Y.Z - Release description"
git push origin vX.Y.Z
```

Confirm the remote annotated tag and peeled commit:

```bash
git ls-remote --tags origin | grep vX.Y.Z
```

For an annotated tag, two lines are expected:

```text
<tag-object-sha> refs/tags/vX.Y.Z
<commit-sha>     refs/tags/vX.Y.Z^{}
```

A `v*` tag automatically triggers `TestigentAI Release Compatibility` in the current framework.

## 16. Current v1.5.3 release checks

The current certified release flow expects these main CI jobs:

```text
Framework Validation
Execution Plan
Project Tests - Shard 1
Project Tests - Shard 2
AI Healing Validation (trusted main run when enabled)
Merge TestigentAI Reports
```

The compatibility matrix verifies:

```text
Ubuntu / Chromium
Ubuntu / Firefox
Ubuntu / WebKit
macOS / WebKit
Windows / Chromium
```

See `41-CURRENT-RELEASE-STATUS.md` and `33-RELEASE-COMPATIBILITY-MATRIX.md` for the current certified evidence.

## 17. Branch cleanup after merge

Delete a merged local branch:

```bash
git branch -d <branch-name>
```

Delete its remote branch:

```bash
git push origin --delete <branch-name>
```

Prune stale remote references:

```bash
git fetch --prune
```

Verify:

```bash
git branch -vv
git status
```

Use `git branch -D` only when you intentionally want to delete an unmerged local branch.

## 18. Update an existing feature branch from main

If the branch is still under development:

```bash
git checkout main
git pull origin main
git checkout <feature-branch>
git merge main
```

Resolve conflicts, validate, then commit/push.

For this repository, prefer an explicit merge/update over rewriting shared branch history unless the team has agreed to rebasing.

## 19. Resolve a merge conflict

Identify conflicts:

```bash
git status
```

After editing each conflicted file:

```bash
git add <resolved-file>
```

Complete the merge:

```bash
git commit
```

Abort an unwanted in-progress merge:

```bash
git merge --abort
```

## 20. Vim appears during a merge commit

If Git opens Vim for a merge message:

Save and exit:

```text
Esc
:wq
Enter
```

Exit without saving/abort that editor action:

```text
Esc
:q!
Enter
```

You can configure another editor if preferred, for example VS Code:

```bash
git config --global core.editor "code --wait"
```

## 21. Safe undo commands

Unstage a file while keeping its working-tree changes:

```bash
git restore --staged <file>
```

Discard unstaged changes to a file:

```bash
git restore <file>
```

Restore a file from `main`:

```bash
git restore --source=main -- <file>
```

Revert an already-published commit safely by creating a new inverse commit:

```bash
git revert <commit-sha>
```

Prefer `git revert` on shared history. Do not use `git reset --hard` or force-push on shared/release branches unless you fully understand the impact and the team has explicitly approved history rewriting.

## 22. Useful troubleshooting commands

Confirm current branch and upstream:

```bash
git status -sb
git branch -vv
```

Confirm remote URL:

```bash
git remote -v
```

Confirm local/remote divergence:

```bash
git fetch origin
git log --oneline --left-right --graph main...origin/main
```

Find the branch containing a commit:

```bash
git branch --contains <commit-sha>
git branch -r --contains <commit-sha>
```

Check whether a feature branch exists remotely:

```bash
git branch -r | grep <branch-fragment>
```

Check tag history:

```bash
git tag --list --sort=-version:refname | head
git show v1.5.3 --no-patch --decorate
```

## 23. Recommended TestigentAI daily cheat sheet

```bash
# Start work
git checkout main
git pull origin main
git checkout -b feature/<work>

# Validate changes
git status
git diff --check
npm run validate:final

# Commit and push
git add .
git status
git commit -m "<type>: <message>"
git push -u origin feature/<work>

# PR
gh pr create --base main --head feature/<work> --title "<title>"
gh pr checks --watch

# Merge after green checks
gh pr merge --merge

# Sync main
git checkout main
git pull origin main

# Watch main CI
gh run list --branch main --workflow playwright-sharded.yml --limit 5
gh run watch <RUN_ID>
```

For a release, add the annotated version tag only after main CI succeeds, then verify the tag-triggered release-compatibility matrix.


## Official GitHub CLI references

- GitHub CLI home/install: <https://cli.github.com/>
- GitHub CLI manual: <https://cli.github.com/manual/>
- Authentication: <https://cli.github.com/manual/gh_auth_login>
- Git credential helper setup: <https://cli.github.com/manual/gh_auth_setup-git>
- Workflow reruns: <https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs>

Use these upstream references when installation/authentication behavior changes; this project guide documents the TestigentAI workflow built on top of `git` and `gh`.

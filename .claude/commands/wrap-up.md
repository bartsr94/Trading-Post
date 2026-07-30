---
description: Create a branch, commit all local changes, and push
---

Wrap up the current work:

1. Run `git status` and `git diff` to see what's changed.
2. Create a new branch off the current branch. Name it based on the actual changes (e.g. `fix/`, `feat/`, `chore/` prefix + short kebab-case description) — don't ask me for a name unless the changes are too ambiguous to summarize.
3. Stage all local changes (`git add -A`).
4. Write a clear, concise commit message that reflects what actually changed (not a generic message). Use conventional commit format if the repo already follows that convention.
5. Commit.
6. Push the new branch to origin, setting upstream (`git push -u origin <branch-name>`).
7. Report back: branch name, commit message, and push status.

Don't create a PR unless I ask for one.
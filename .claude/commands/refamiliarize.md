---
description: Re-orient on the current repo's structure, conventions, and recent activity
---

Get up to speed on this repository before doing anything else. Work through this systematically:

1. **Project identity**: Read README.md, CLAUDE.md, and any package.json / pyproject.toml / .csproj to identify the stack, purpose, and entry points.

2. **Structure**: List the top-level directory tree (2-3 levels deep, skip node_modules/dist/build/.git). Note where source, tests, and config live.

3. **Git state**:
   - Current branch and its relation to main/master (ahead/behind)
   - `git status` for uncommitted changes
   - Last 15-20 commits (`git log --oneline -20`) to see what's been worked on recently
   - Any open stashes

4. **Conventions**: Check for linting/formatting config (eslint, prettier, ruff, etc.), test framework and how tests are run, CI config (.github/workflows, bitbucket-pipelines.yml, etc.).

5. **In-flight work**: Grep for TODO/FIXME/XXX markers, check for any docs/notes/, ADRs, or a scratch/planning file that indicates what's currently being built.

6. **Testing setup specifics** (if this is a test automation repo): identify test tiers/directories, reporting setup (e.g. Allure), and any environment/config files needed to run tests locally.

Once done, give me a concise summary (not a wall of text) covering:
- What this repo is and its stack
- Current branch + any uncommitted work
- What the last few commits were doing (the "story" of recent work)
- Anything that looks unfinished or in-progress
- Anything unusual/notable I should know before making changes

Don't propose changes or start any task yet — this is orientation only. Wait for my next instruction.
Print this command list, then stop — do not run any protocol step.

```
/docs        — Scan for all existing docs and identify which ones are affected
               by the work we just completed (report only, no edits)
/update      — Propose and apply updates to every affected doc, one file at a
               time, after approval
/update-file — Update one specific file only. Usage: /update-file README.md
/diff        — Show a before/after diff of proposed changes before applying
/changelog   — Add an entry for the completed work (asks first — no
               CHANGELOG.md exists in this repo yet)
/summary     — One-paragraph plain-English summary of what changed, for PR
               descriptions or standup notes
/commands    — Print this list
```

Full protocol, rules, and the file routing guide live in
`.claude/commands/docs.md`.

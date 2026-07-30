Update a single documentation file to reflect the work just completed in
this conversation. Target file: $ARGUMENTS

If no file was given, ask which one before doing anything else.

Follow `.claude/commands/docs.md`, scoped to only the named file:

1. Review what changed in this conversation that's relevant to that file
2. Propose the specific change (section to update, new content, anything to
   remove) and wait for approval
3. Apply it

Still follow the Rules and Gotchas in `.claude/commands/docs.md` — match the
file's existing tone/formatting, don't add sections it doesn't already have
unless asked, and remember `CLAUDE.md` and everything under `docs/` except
`docs/GAME_FEATURES.md` is gitignored (edit the working copy, don't expect it
to be stageable).

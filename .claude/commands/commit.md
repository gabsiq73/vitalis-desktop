# /commit — Commit with standards

Stage the specified files (or all changes if none given) and create a commit following the project's commit standards defined in `CLAUDE.md`.

**Checklist before committing:**
1. [ ] Message is in English
2. [ ] Format: `<type>(<scope>): <summary>` — imperative, lowercase, no period, ≤72 chars
3. [ ] Type is one of: `feat` `fix` `refactor` `style` `chore` `docs` `test`
4. [ ] No `Co-Authored-By` or any AI/Anthropic attribution
5. [ ] Author is `Gabriel Siqueira <gabriel.siqueira3000@gmail.com>`

Run: `git log -1 --format="%an | %ae | %s"` after committing to verify authorship.

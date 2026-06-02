# Vitalis Frontend — Project Instructions

## Commit Standards

Before every `git commit`, follow these rules **without exception**:

### Author
- Commits must be authored only by `Gabriel Siqueira <gabriel.siqueira3000@gmail.com>`
- **Never** add `Co-Authored-By`, `Co-authored-by`, or any Anthropic/Claude attribution line
- **Never** add any AI tool reference in commit messages or trailers

### Language
- Commit messages must be written in **English**

### Format
```
<type>(<scope>): <short summary>

<optional body — bullet points for non-trivial changes>
```

### Types
| Type | When to use |
|------|-------------|
| `feat` | New feature or user-visible behavior |
| `fix` | Bug fix |
| `refactor` | Code change that is not a feat or fix |
| `style` | Formatting, missing semicolons, etc. |
| `chore` | Build process, dependencies, tooling |
| `docs` | Documentation only |
| `test` | Adding or updating tests |

### Rules
- Summary line: imperative mood, lowercase after the colon, no period, max 72 chars
- Body: explain *what* and *why*, not *how*; use bullet points (`-`) for multiple changes
- Scope is optional but preferred when changes are isolated to one area (e.g. `fix(auth): ...`)

### Examples — good
```
feat(orders): add delivery/pickup toggle to new order modal
fix(clients): parse 422 validation errors from backend
chore(deps): pin tailwindcss to v3 for postcss compatibility
```

### Examples — bad
```
# Wrong: not English
feat: adicionar modal de pontos de fidelidade

# Wrong: has co-author
feat: add feature
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

# Wrong: vague
fix: fixed stuff

# Wrong: has period, past tense
feat: Added the new modal.
```

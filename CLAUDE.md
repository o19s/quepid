## ClaudeOnRails configuration

You are working on Quepid, a Rails application. Read the ClaudeOnRails context at `.claude-on-rails/context.md`.

We run Quepid in Docker primarily, don't run Rails and other build tasks locally.
### Where the real docs live (avoid duplicating here)

| Topic | Authoritative doc |
|-------|-------------------|
| Docker, `bin/docker`, tests, lint, CI, debugging | [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) |
| Data model | [docs/data_mapping.md](docs/data_mapping.md) |
| App layout and structure | [docs/app_structure.md](docs/app_structure.md) |
| Stimulus controllers, `apiUrl()`, new-UI testing rules | [docs/stimulus_and_modern_js_conventions.md](docs/stimulus_and_modern_js_conventions.md) |
| Project Rails/URL/style conventions (also in Cursor rules) | [.cursor/rules/quepid-project.mdc](.cursor/rules/quepid-project.mdc) |

Put documentation in **`docs/`**, not a top-level `doc/` directory.

### Git commits

- Do **not** add `Co-Authored-By`, `Made-with`, or any other trailer or line that attributes the commit to an AI tool (Claude, Cursor, Copilot, etc.).

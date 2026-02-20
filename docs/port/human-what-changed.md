# Human: What Changed?

## Introduction

This document is written by a human and offers a somewhat concise guide to what has changed between the deangularjs and deangularjs-experimental branches. It does not cover changes between the main branch and these branches (they diverge at the same point). A comparison of the main and deangularjs branches will reveal the details of those changes.

## Overview

This branch takes the work Eric started on deangularjs and extends it to the entire Quepid application. The result is the complete removal of AngularJS from the codebase along with several other dependencies, replacement with a modern Ruby on Rails stack, and general cleanup of the codebase. This was AI assisted and at this point several additional rounds of review and refinement are likely needed before the code is fully production ready.

## Removed AngularJS and the New Stack

- AngularJS has been fully removed from the codebase and everything has been rewritten using a modern Ruby on Rails stack. Specifically:
    - Stimulus
        - `window.flash` - for dynamic feedback
    - Turbo (Hotwire)
        - Turbo Frames - for dynamic regions
        - Turbo Streams
    - ViewComponents - allows us to retain the advantages of componentized code without needing to use a frontend framework.
    - Bootstrap 5
    - Rails
        - Flash - for redirects
- We were using Vega-Lite and D3 for charts and similar purpsoes, D3 has been removed and everything is now done using Vega-Lite.
- Added SortableJS (do we need? can we use bootstrap?)

## Tooling

### Linting and Formatting

- Replace jshint with eslint and prettier, integrated into CircleCI.
- Lefthook which runs pre-commit hooks.
    - We run tests associated with files we have changed.
    - We run Rubocop on Ruby, ESLint and Prettier on JS.

### AI

- Added commands and rules for Cursor
    - Code Review should be used after any significant change, it tells the AI to look for errors, bugs, regressions, bad practices, etc. It is especially important to do this after the AI has written code - it often finds its own errors.

## Testing

- Removed Karma
- Added Vitest
    - Added tests.
- Added script to test visual parity between branches and generate a report with side-by-side screenshots.
- Added Playwright.
- Also jsdom.

## Database

- Added `cases`, `export_job` and `string` to `export_job_to_cases`.
- Added `case_imports` with columns `case_id`, `user_id`, `cases`, `users`, `import_params`, and `status`.


## General Cleanup

- Migrated from Bootstrap 3 to Bootstrap 5 wherever 3 still remained.
- Migrated custom CSS to utilize Bootstrap 5 where possible.
- Cleaned up dead and duplicative CSS.
- Implement CSS Variables (`variables.css`).
- Created utility classes to replace common inline styles.
- Extracted inline CSS to stylesheets.
- Extracted core.css styles into a variety of categorized files named core-*.css
- Extracted reused code and implemented shared functions to improve DRYness.
- Extracted lengthy code into more manageable functions called by the original lengthy function.
- Improved type safety and guardrails throughout.
- Replaced Splainer dependency with built-in functionality.
- Removed jQuery as dependency, replaced with Vanilla JS, Stimulus, Bootstrap.
- Fixed a Docker startup ordering issue (only seen on warm startups)

## Documentation and AI

Software projects are generally known for their sparcity of documentation and the lack of quality in those documents. AI supported projects can suffer from the opposite problem. AI has no problem talking about everything and in a fairly verbose manner. This can be overwhelming and make it difficult to know what one actually needs to pay attention to.

Yet deleting all this extraneous documentation is not ideal either - even historical docs. This is because of the current limitations on AI memory. Without documentation it can use to understand a project its performance and reliability degrade significantly. I recommend that we accept the increase in documentation while also working to provide human written documents that provide succinct guidance on a project and point to areas of AI documentation* that may be helpful when one needs a deeper dive.

* AI Documentation needs human review. It is not enough to generate it, it also requires oversight. The reliability of the documentation for human purposes is limited by the extent to which it has been edited and curated by a human editor.
# Human: What Changed?

## Introduction

This document is written by a human and offers a somewhat concise guide to what has changed between the deangularjs and deangularjs-experimental branches. It does not cover changes between the main branch and these branches (they diverge at the same point). A comparison of the main and deangularjs branches will reveal the details of those changes.

## Removed AngularJS and the New Stack

- AngularJS has been fully removed from the codebase and everything has been rewritten using a modern Ruby on Rails stack. Specifically:
    - Stimulus
        - `window.flash` - for dynamic feedback
    - Turbo (Hotwire)
        - Turbo Frames - for dynamic regions
        - Turbo Streams
    - ViewComponents
    - Bootstrap 5
    - Rails
        - Flash - for redirects

## Tooling

### Linting and Formatting

- Replace jshint with eslint and prettier, integrated into CircleCI.
- Lefthook which runs pre-commit hooks.
    - We run tests associated with files we have changed.
    - We run Rubocop on Ruby, ESLint and Prettier on JS.

### AI
- Added commands and rules for Cursor
    - Code Review should be used after any significant change, it tells the AI to look for errors, bugs, regressions, bad practices, etc. It is especially important to do this after the AI has written code - it often finds its own errors.

## General Cleanup
- Migrated from Bootstrap 3 to Bootstrap 5 wherever 3 still remained.
- Cleaned up dead and duplicative CSS.
- Implement CSS Variables.
- Created utility classes to replace common inline styles.
- Extracted inline CSS to stylesheets.
- Extracted core.css styles into a variety of categorized files named core-*.css


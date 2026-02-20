# How to contribute

This guide is essential to keeping the contribution process easy and simple for everyone. As the team grows, we need to make sure there are guidelines for what is expected from each contributor. Also, to ensure that the applications we contribute to continue to be maintainable, we need to define what that looks like.


## Getting Started

* Make sure you have a [GitHub account](https://github.com/signup/free)
* Submit a ticket for your issue, assuming one does not already exist.
  * Clearly describe the issue including steps to reproduce when it is a bug.
  * Use the `ISSUE_TEMPLATE/*` as a guide.
* Clone the repo.

## Making Changes

* Create a topic branch from where you want to base your work.
  * This is usually the staging branch.
  * Only target release branches if you are certain your fix must be on that
    branch.
  * Use the type of work (feature, bugfix, enhancement) at the beginning of the branch name if applicable (eg. `feature/123-branch-name`).
  * Follow the type by the Github ticket number at the beginning of the branch name if applicable (eg. `feature/123-branch-name`).
  * Use a short but descriptive name of the branch that matches the ticket title or summary (eg. `feature/123-add-csv-import`).
  * Use dashes in the name as a separator.
  * To quickly create a topic branch based on staging; `git checkout -b feature/123-add-csv-import staging`. Please avoid working directly on the
    `main` or the `staging` branch.
* Make commits of logical units.
* Check for unnecessary whitespace with `git diff --check` before committing.
  * Make sure you have setup your editor to trim ending whitespace.
  * Make sure you have setup your editor to add an empty line at the end of each file.
  * Make sure you have setup your editor to use spaces instead of tabs, and indentations of 2 spaces.
* Run `rubocop` before committing to ensure your changes meet our style guidelines.
  * Even though rubocop allows lines of up to 120 characters, try to keep it under 80.
  * Set your editor to show a wrap-guide line at 80 characters to help you follow this rule.
  * You can disable rubocop rules inline when necessary, but try not to make a habit of it.
  * If you strongly disagree with a rubocop rule, discuss it with the team and we can
    potentially change the configuration.
* **Pre-commit hooks (Lefthook):** If you have [Lefthook](https://github.com/evilmartians/lefthook) installed (via `bin/setup` or `bin/setup_docker`), it runs automatically on commit:
  * **Rubocop** on staged `.rb` files
  * **ESLint and Prettier** on staged `.js` files
  * **Related tests** (Vitest for JS, Minitest for Ruby) based on staged files
  * To bypass hooks in edge cases (e.g. WIP commits, emergency hotfixes), use `git commit --no-verify`. Use sparingly.
* Make sure your commit messages are in the proper format.

```git
(#123) Make the example in CONTRIBUTING imperative and concrete

Without this patch applied the example commit message in the CONTRIBUTING
document is not a concrete example. This is a problem because the
contributor is left to imagine what the commit message should look like
based on a description rather than an example. This patch fixes the
problem by making the example concrete and imperative.

The first line is a real life imperative statement with a ticket number
from our issue tracker. The body describes the behavior without the patch,
why this is a problem, and how the patch fixes the problem when applied.
```

* Make sure you have added the necessary tests for your changes.
* Run _all_ the tests to assure nothing else was accidentally broken.

## Writing Translatable Code

Rails has i18n baked in, so we should put all user facing strings in translation files.

When adding user-facing strings to your work, follow these guidelines:
* Use full sentences. Strings built up out of concatenated bits are hard to translate.
* Use scopes to organize strings based on where they are used.
  Example:
  ```yml
  en:
    views:
      qualified_leads:
        index:
          header: Qualified Leads
  ```
  or
  ```yml
  en:
    mailers:
      qualified_leads:
        notify_admins:
          subject: New Qualified Lead
  ```
* Use a directory structure that mimics the namespacing.
* Use the name of the class (eg. the AR model, or controller) to group strings.
* Use the name of the method or action when applicable.
* Use `success` and `error` under controller actions to differentiate between the happy path and the failure path.
* Use variables when needed to pass dynamic content to the string.
  Ex. `t :body, scope: [ :qualified_lead_mailer, :notify_admins ], lead_id: @lead.short_id, name: @name`
* Use pluralization that is baked into Rails i18n for handling situations where the count matters.

For more info, checkout the [guides](https://guides.rubyonrails.org/i18n.html).

It is the responsibility of contributors and code reviewers to ensure that all user-facing strings are marked in new PRs before merging.

## Making Trivial Changes

### Documentation

For changes of a trivial nature to comments and documentation, it is not
always necessary to create a new ticket. In this case, it is appropriate to
start the first line of a commit with the type of change (eg. '(doc)' or '(bugfix)') instead of a ticket number.

```git
(doc) Add documentation commit example to CONTRIBUTING

There is no example for contributing a documentation commit
to the repository. This is a problem because the contributor
is left to assume how a commit of this nature may appear.

The first line is a real life imperative statement with '(doc)' in
place of what would have been the ticket number in a
non-documentation related commit. The body describes the nature of
the new documentation or comments added.
```

## Submitting Changes

* Push your changes to a topic branch.
* Submit a pull request to the repository.
* Try to keep PRs small, focused and self-contained. The goal is to have a high velocity of small changes instead of less frequent, large changes.
* Assign another developer as the primary reviewer. They should try to review the PR within one business day time.
* Try to respond to PR feedback within one business day. If a requested change is going to require more time to develop, at least acknowledge the comment and consider applying an "updating per feedback" label to the PR.
* PRs may not be merged to main until they have been approved by at least one other developer.
* Use PR labels to flag special cases, like "not ready for review" or "do not deploy"
* You can mention other developers that might be interested in a comment or description with an `FYI @username` reference.


# Additional Resources

* [General GitHub documentation](https://help.github.com/)
* [GitHub pull request documentation](https://help.github.com/articles/creating-a-pull-request/)

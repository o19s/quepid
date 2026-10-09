# Comparison gallery workflow

Use this when the user wants to judge several UI changes visually or requests a
before/after gallery. Follow the repository's existing server, worktree, browser
recovery, screenshot and manual-tracker rules in [AGENTS.md](../../../../AGENTS.md).

## Capture isolated comparisons

- For an ordinary branch comparison, retain the skill's branch baseline. For
  proposed alternatives, **before is the current workspace, including staged and
  unstaged sources; after applies only the named proposal**. Record the baseline
  commit and the copied source inputs or their checksums.
- Map each candidate to an affected page, control and state. Capture the full
  requested candidate batch; reuse a baseline state only when its sources and
  presentation are identical. An absent branch diff does not block a proposal
  gallery whose candidates already identify the affected UI.
- Apply proposals in a separate worktree and comparison server, preserving the
  primary sources and index. Reset the scratch sources to the captured baseline
  between variants, then apply one proposal and rebuild in that comparison
  container. Do not replace browser scripts to replay old implementations.
- Match viewport, authentication, data, selected tabs, open panels, scroll
  position and pointer state. Settle loading indicators and dismiss transient
  flashes on both sides. Recapture mismatched states before attributing their
  differences to the proposal.
- Prefer read-only interactions. For a visual-only success/error state, an
  intercepted API response can avoid a database mutation; label it as simulated
  and do not claim persistence was tested. If fixture URLs point to the primary
  origin, scoped request routing may fetch the same fixture from the comparison
  origin; document that adjustment without changing the stored endpoint.
- Save original full-viewport PNG pairs under `.playwright-mcp/<topic>/` using
  `*-before.png` and `*-after.png`. Keep capture timestamps separate from later
  gallery-generation or annotation timestamps.

## Make the change easy to find

- Give each candidate a numbered card with its title, sampled flow, exact
  proposed removal/change, and a short description of the observed difference.
- **Put conspicuous matching boxes around the relevant area on both images.**
  Use a shared region covering the before/after bounds with enough padding to
  leave the changed pixels visible. Use separate boxes for distinct areas, such
  as a success alert and list row, or the four corners of a rounded dialog.
- For pixel-identical pairs, box the control being checked and label it **no
  visual change in the captured state**. Do not invent a changed region or imply
  that untested interactive states are identical.
- Preserve the original PNGs. Render boxes as HTML/CSS overlays positioned in
  screenshot coordinates and scaled as percentages, so they remain aligned
  when images resize. A contrasting outline keeps boxes visible on light and
  dark backgrounds without covering the contents.
- Provide side-by-side views, an overlay slider and full-size views. Retain
  highlight boxes in every mode, including the full-size links. Include navigation
  between candidates and distinguish cosmetic, spacing and color differences.

## Verify and deliver

Open and inspect every pair as required by the skill. Pixel-difference bounds
help locate changes but cannot replace visual inspection; broad differences may
indicate mismatched session or scroll state. Inspect the rendered gallery too:
check box placement, image loading, slider alignment and full-size links.

Keep the gallery and its manifest alongside the captures. Record candidate-to-file
mapping, viewport sizes, baseline provenance, highlight coordinates, and any
simulated responses or deferred coverage. Update only manual-tracker scenarios
actually exercised, describing partial coverage honestly.

Serve the topic directory on an unused local port and provide a direct gallery
link. Also offer a portable ZIP containing the HTML, manifest, original screenshots
and highlighted full-size pages; use relative asset links and no external runtime
dependencies. Leave the viewer available for review and follow the skill's teardown
rules for the temporary comparison app. Do not depend on a particular prior
gitignored gallery or hard-code its candidates, port or worktree name.

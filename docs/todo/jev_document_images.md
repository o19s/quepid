# Document images for AI judges — task list

> **Decision record:** [ADR 0009](../adr/0009-jev-document-images.md). This file is the task
> breakdown; the ADR holds the reasoning. D-numbers below refer to the ADR.
>
> **Status:** phases 1 and 2 built on `feature/jev-product-images` (2026-11-28); a live Jev call
> with a real key (2.21) is still to do.
> Jev's switch is enabled in phase 1 (decided 2026-11-28): ticking it is saved but sends no image until
> phase 2, so the two phases should ship together.

Two phases. Phase 1 builds the settings and their storage: everything a person sees and saves.
Phase 2 makes the adapters act on them. Each phase is one reviewable PR.

**Between the phases.** After phase 1 alone, a Jev judge can tick **Judge with images** and save
an image type and dimensions, but Jev still sends no image. Either merge the two phases together,
or have phase 1's Jev help text say images are coming and keep the Jev switch disabled until phase 2
(task 1.4).

## Phase 1 — Settings UI

### Registry (`app/models/llm_provider.rb`)

- [x] **1.1** Add `images_by_default` (boolean, default true) — D1. Jev: false.
- [x] **1.2** Add `image_types` (array; first entry is the default) — D11. Jev: `%w[base64]`;
  OpenAI: `%w[url base64]`; every other provider that supports images: `%w[url]`; providers
  without image support: `[]`.
- [x] **1.3** Add `image_dimensions` (`{ min:, max:, recommended: }` or nil) — D10. Jev:
  `{ min: 280, max: 1568, recommended: 300 }`. OpenAI: values from OpenAI's vision documentation,
  looked up when this task is done and cited in a code comment. Everyone else: nil.
- [x] **1.4** Jev: `supports_images: true`, and a Jev-specific images help line in place of the
  generic "Attached as an image URL" one (see the note under "Between the phases").
- [x] **1.5** Expose `images_by_default`, `image_types` and `image_dimensions` in `to_preset` for the
  form JavaScript.

### Existing judges (D9)

- [x] **1.6** Data migration: set `judge_options.llm_include_images` to `"false"` on every AI judge
  whose `judge_options.llm_provider` is `typesafe_jev`. `down` is a no-op. Iterate in Ruby, not a
  JSON query, because the app runs on both MySQL and PostgreSQL.
- [x] **1.7** `Base#include_images?`: a blank stored value takes the provider's `images_by_default`.

### Validation (`app/models/ai_judge.rb`)

- [x] **1.8** `llm_image_type` must be one of the provider's `image_types`; blank is allowed and
  means the provider's default.
- [x] **1.9** `llm_image_dimensions` must be a whole number within the provider's
  `image_dimensions` bounds; blank is allowed. It is refused on a provider with no bounds, and when
  the effective image type is `url`.
- [x] **1.10** Both are rechecked when the judge moves to another connection: the provider comes
  from the connection (`leave_own_settings_for_connection`), so validate after it is applied.
- [x] **1.11** Permit `llm_image_type` and `llm_image_dimensions` in `AiJudgesController` and
  `AiJudges::WizardController` (which has its own `permit` list).

### Form (`app/views/ai_judges/`)

- [x] **1.12** Images row: a blank stored `llm_include_images` starts the switch at the provider's
  `images_by_default`, not always on. Pass `provider` into `_provider_options`.
- [x] **1.13** New collapsed **Advanced settings** section below the Images row (a Bootstrap 5
  collapse, closed by default). Later (2026-11-28) LLM Model, LLM API Version and Limit to scales
  moved into it too, for every provider; the image rows below show only where there is something
  to pick:
  - **Image type** select (`llm_image_type`): options from the provider's `image_types`. With one
    value (Jev), the select is shown disabled with a hint that Jev can't fetch URLs, and a hidden
    field submits the value.
  - **Image dimensions** number field (`llm_image_dimensions`): `min`/`max` from the provider, the
    provider's `recommended` size as the placeholder and in the hint ("Blank uses the
    recommended 300 px"); nothing is filled in or stored.
- [x] **1.14** The section opens on render when either field has a validation error. Both fields
  are disabled while **Judge with images** is off; dimensions is also disabled while the image type
  is `url`. The section is hidden for a provider with one image type and no bounds.
- [x] **1.15** Leave `llm_image_type` and `llm_image_dimensions` out of the generic judge-options
  loop in `_provider_options.html.erb` (its `except` list), so they don't also render as plain text
  fields.

### Form JavaScript (`ai_judge_form_controller.js`)

- [x] **1.16** `syncImages`: switching to an opt-in provider (Jev) starts the switch off. That
  provider's choice neither sets nor takes the preference shared by the other providers, and
  switching back restores the earlier choice (keep the existing "keeps the wanted image choice"
  test passing).
- [x] **1.17** On provider change: rebuild the image type options, lock or unlock the select, set
  the dimensions field's `min`/`max`, show or hide the Advanced section; on image type or switch
  change: enable or disable the dimensions field.

### Tests and docs for phase 1

- [x] **1.18** `test/models/llm_provider_test.rb`: the new attributes and preset keys; Jev supports
  images and is opt-in.
- [x] **1.19** `AiJudge` validation tests: 279 and 1569 refused for Jev, 280 / 1568 / blank
  accepted, a fraction refused, any value refused on a provider without bounds, dimensions refused
  with `url`, `url` refused for Jev, `base64` refused for a URL-only provider, and a connection
  switch revalidating stored values.
- [x] **1.20** Migration test: Jev judges flipped to `"false"`, other providers untouched.
- [x] **1.21** `test/services/llm_judge_adapters/` (or `llm_service_test.rb`): a blank switch means
  off for Jev and on for OpenAI.
- [x] **1.22** Vitest (`test/javascript/controllers/ai_judge_form_controller.test.js`): opt-in
  switch behaviour, image type options and lock per provider, `min`/`max` swap, dimensions
  disabled with `url`.
- [x] **1.23** (the spec is still `fixme` for the connection rework, so its new expectations don't run yet) Playwright (`test/playwright/llm_providers.spec.ts`): update the Jev expectations
  (switch enabled and unticked) in the existing `fixme` spec, and add an Advanced section check:
  closed by default, Jev's type locked to base64, an out-of-range value refused on save with the
  section open.
- [x] **1.24** Manual testing: revise scenario 12.6 (Jev's switch is now enabled and opt-in) and
  12.10; add the Advanced section steps; extend `tracking.yml` paths.
- [ ] **1.25** Screenshots via Playwright MCP of the form for OpenAI and Jev, Advanced section
  closed and open, using the `branch-ui-diff` skill for before/after.
- [x] **1.26** Checks: `rails test`, `yarn test:unit`, `yarn lint:js`, `yarn format:js:check`,
  rubocop, `bin/manual_test_status`.

## Phase 2 — Use the images

### Image loader (new, beside the adapters)

- [x] **2.1** Pick the source (D4): `image` before `thumb`; an absolute http(s) URL or a
  `data:image/...;base64,` value; anything else means no image and no note.
- [x] **2.2** Download (D5): resolve the host and refuse any address `ProxyAllowlist#blocked?`
  rejects; don't follow redirects; its own short timeout, separate from `llm_timeout`; stop reading
  at 16 MiB. Mark the DNS-rebinding gap with a `shortcut:` comment.
- [x] **2.3** Decode a `data:` value strictly; an invalid one is a skip.
- [x] **2.4** (built with libvips reading the header instead of hand parsing; APNG and animations use
  their first frame rather than being skipped) Inspect the bytes: format from magic bytes (PNG, JPEG), APNG (`acTL` before `IDAT`),
  dimensions from PNG `IHDR` / JPEG `SOFn`, and the pixel cap before any decoding.
- [x] **2.5** Resize (D10) every base64 image: shorter side to `llm_image_dimensions`, or to the
  provider's `recommended` size when blank, up or
  down; longer side capped at the provider's max; re-encode as JPEG (about 85); flatten
  transparency onto white; first frame of an animation; never render SVG. Skip when the result
  still falls outside the provider's bounds.
- [x] **2.6** After resizing, apply the provider's accepted formats and bounds and skip what still
  fails (D5).
- [x] **2.7** Return the bytes and format, or a short reason for the skip note. Never raise for an
  unusable image.
- [x] **2.8** Add `ruby-vips` to the Gemfile and `libvips` to `Dockerfile.dev` (it is already in
  `Dockerfile.prod`).

### Jev adapter (`app/services/llm_judge_adapters/jev.rb`)

- [x] **2.9** In `request_envelope`, when images are on: load the image; on success add
  `assets: { ref => { type: 'image', format:, data_base64: } }`, put `ref` in a top-level
  `state.image` key (D7: `quepid-image-<sha256 prefix>`), and add the
  `TypeSafe-Danger-Zone-Images: true` header (D3). On a skip, send the request exactly as today.
- [x] **2.10** Build the question before loading the image, so a missing scale still fails first.
- [x] **2.11** Keep the skip reason on the adapter, reset at the start of every `request_envelope`
  (D6), and append `[document image not sent: <reason>; judged on text only]` to the explanation in
  `apply_response`.
- [x] **2.12** Update the class comments that say Jev is text only.

### OpenAI adapter (`app/services/llm_judge_adapters/open_ai.rb` / `base.rb`)

- [x] **2.13** With image type `base64`, load the image through the same loader and send
  `image_url: { url: "data:image/jpeg;base64,..." }` (or `image/png` when the image was not
  re-encoded). With `url` or a blank value, behave exactly as today.
- [x] **2.14** The skip note reaches the OpenAI explanation the same way as Jev's (D6).
- [x] **2.15** Keep the adapters' existing request and preview paths working: `user_prompt` stays
  free of downloads, so the prompt preview doesn't fetch images.

### Adapter fallbacks

- [x] **2.16** A stored image type the provider no longer allows falls back to the provider's
  default; out-of-range stored dimensions count as blank (D10, D11).

### Tests and docs for phase 2

- [x] **2.17** Loader tests on hand-built PNG/JPEG header bytes and small real fixtures:
  dimensions, the bounds, APNG, wrong magic bytes, the size cap, the pixel cap, `data:` values, and
  blocked addresses using IP-literal URLs (`127.0.0.1`, `169.254.169.254`, `10.0.0.1`), so the
  tests need no DNS.
- [x] **2.18** Resize tests: shorter side scaled, upscaling a thumbnail, the longer side capped, a
  banner that can't fit skipped, WebP and GIF converted, SVG skipped, a blank setting resizing to
  the provider's recommended size.
- [x] **2.19** Jev adapter tests (webmock): the asset shape, the reference present in `state`
  exactly once, the header only with an asset; no `assets` and no header when the switch is off, with
  no image, and for each skip case; the skip note; the note reset between two pairs on one adapter.
- [x] **2.20** OpenAI adapter tests: `base64` sends a `data:` URL; `url` and blank send the link.
- [ ] **2.21** Manual testing: one live Jev call with a real TypeSafe key and an image, before
  12.10 is recorded as a pass; an OpenAI judge on base64; update `tracking.yml`.
- [x] **2.22** Update `docs/todo/jev_llm_judge.md` D2 ("text only") to point at ADR 0009.
- [ ] **2.23** Checks: `rails test`, `yarn test:unit`, lint, rubocop, Mutant incremental on the new
  loader, `bin/manual_test_status`.

## Follow-ups built after phase 2

- [x] Marker in the explanation when an image was sent: `[with document image, W×H]`.
- [x] Image download timeout as an Advanced setting (ADR 0009 D12): `llm_image_timeout`, 0.1–60 s in
  tenths, blank = 0.3, base64 only, validated on save.
- [x] Mutant gaps closed on `DocumentImage` (large and portrait images, the 280 px boundary, JPEG,
  GIF87a, AVIF, non-WebP RIFF, upper-case scheme and stray spaces, line-wrapped base64, a host
  with no addresses, white flattening); an upper-case `HTTP://` URL used to raise and is fixed.

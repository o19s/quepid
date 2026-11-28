# ADR 0009 — Document images for AI judges: Jev support, URL or base64, and resizing

- **Status:** Proposed
- **Date:** 2026-11-28
- **Affects (when built):** `app/services/llm_judge_adapters/jev.rb`, a new image loader beside it,
  `app/services/llm_judge_adapters/base.rb` (`include_images?`), `app/models/llm_provider.rb`
  (the Jev entry, help text), `app/views/ai_judges/_provider_options.html.erb`,
  `app/views/ai_judges/_form.html.erb`, `app/javascript/controllers/ai_judge_form_controller.js`,
  a data migration on AI judges' `judge_options`, `docs/manual-testing/12-ai-judges.md` (12.6, 12.10);
  for D10 and D11, `app/services/llm_judge_adapters/open_ai.rb` (base64 `data:` URLs),
  `app/models/ai_judge.rb` (validation), `Gemfile` (`ruby-vips`) and `Dockerfile.dev`
  (`libvips`)
- **Builds on:** [ADR 0001](./0001-llm-judge-provider-architecture.md) (the adapter seam, Jev).
  This ADR supersedes 0001's "Jev is text only / `images? false`" for Jev. The rest of 0001 stands.
- **Source:** TypeSafe's images guide, <https://docs.typesafe.ai/images.md>, and the System One
  API reference, <https://docs.typesafe.ai/api-reference>, read 2026-11-28

---

## 1. Context

A chat judge (OpenAI, Anthropic and the other chat providers) can see a document's image when the AI
judge's **Judge with images** switch is on: `LlmJudgeAdapters::Base#user_prompt` adds the document's
`image` URL (or its `thumb` URL) to the prompt as an `image_url` block, and the provider downloads it.
Jev cannot: its registry entry has `supports_images: false`, the switch is disabled for it, and
the image URL reaches Jev only as text inside `state.document`.

Jev now accepts images. According to TypeSafe's documentation:

- **No URLs.** The API never downloads anything. An image is sent as bytes: base64 in a top-level
  `assets` map, or as a multipart file part. `state` carries a *reference string* that is a key
  of `assets`, and the API swaps the reference for the image wherever it appears.

  ```json
  {
    "model": "jev-latest",
    "state": { "query": "...", "document": { ... }, "image": "quepid-image-3f1c..." },
    "assets": {
      "quepid-image-3f1c...": { "type": "image", "format": "jpg", "data_base64": "/9j/4AAQ..." }
    },
    "questions": { "relevance": { ... } }
  }
  ```

- **A header.** Every request that carries an image must send `TypeSafe-Danger-Zone-Images: true`.
- **`data_base64` format.** Standard base64 with `=` padding, no whitespace or line breaks, and no
  `data:` prefix. `format` is `png`, `jpg` or `jpeg`, and is required alongside `data_base64`.
- **Limits.** PNG or JPEG only; animated PNG is rejected. Each side must be 280–1568 px, each image
  at most 16 MiB decoded, and the request body at most 32 MiB. Image tokens count toward the
  64k-per-request and 32k-per-question context limits and are billed at the text input price.
  There is no published way to estimate how many tokens an image costs.
- **Strict validation.** A single unusable image fails the whole request with a 400 (or a 413 for
  a size limit). Every asset must be referenced somewhere in the request, or the API returns 400.
- **Models.** Jev 1.13 and 1.14 accept images. `jev-latest` currently points to 1.14.

## 2. Decision

**D1 — Jev gets images, but only when the judge opts in.** Jev's registry entry supports images.
For Jev, a judge with no saved `llm_include_images` value counts as **off** (for every other
provider it still counts as on). This needs a new per-provider default on `LlmProvider`, which
`Base#include_images?`, the form's initial checkbox state and the form JavaScript all read. When
someone switches the form to Jev, the box starts unticked, and switching back to another provider
still restores the choice made there (manual scenario 12.6).

**D2 — Quepid downloads the image and sends it as base64 in the JSON body.** Not multipart:
base64 keeps the request a JSON hash on the existing Faraday JSON connection
(`LlmConnection`), so `LlmService#post` and the adapter tests stay as they are. It costs about a
third more bytes. One image is at most 16 MiB, which is about 21.3 MiB as base64, plus 80k characters of
state, so a request stays under the 32 MiB body limit.

**D3 — The header goes only on requests that carry an image.** It is sent when an asset is
actually attached, not merely because the judge's switch is on. A judge whose pair has no image,
or whose image was skipped (D5), sends the same request as today.

**D4 — Which image.** Same rule as the chat judges (`Base#image_url_for`): `image` wins over
`thumb`, and one image per request. A document field that already holds a
`data:image/...;base64,...` value is decoded and used directly, with no download. Everything else
must be an absolute http(s) URL.

**D5 — An image that can't be used is skipped, and the pair is judged on its text.** The
judgement still gets a rating, and its explanation gets a note saying why the image was left out
(for example, `[document image not sent: webp is not PNG or JPEG; judged on text only]`). It is not
marked unrateable: small thumbnails and WebP are common enough in search results that failing them
would turn a judging run into a pile of unrateable pairs. Quepid skips an image for any of these:

| Case | Detected by |
| --- | --- |
| Download fails: DNS, timeout, non-2xx (including a redirect), connection error | The download |
| Host resolves to a loopback, link-local or private address | `ProxyAllowlist#blocked?`, as `ProxyController#validate_proxy_url!` does |
| Not PNG, JPEG, WebP, GIF or AVIF (SVG, an HTML error page) | Magic bytes, not `Content-Type` or the data URI's declared type; SVG never reaches libvips |
| Over 50 megapixels | libvips reads the size from the header, before decoding any pixels |
| Can't be resized to fit the provider's bounds (a very wide banner) | After scaling (D10) |
| Over 16 MiB | Size cap while reading the response, not after buffering it all |
| A `data:` value that is not valid base64 | Strict decode |

Every base64 image is resized and re-encoded as JPEG (D10), so WebP, GIF, AVIF, animated images
(first frame) and transparency are converted rather than skipped, and Jev's own format and
dimension limits are met by construction.

**D6 — The note travels from the request to the explanation on the adapter.** The skip reason is
known while building the request (`request_envelope`), but the explanation is written in
`apply_response`, and `LlmService#perform_judgement` passes nothing from one to the other. The Jev
adapter keeps the reason on the instance and **resets it at the start of every
`request_envelope`**, so in a sequential Judge Judy run one pair's note never lands on the next
pair. This leaves `LlmService` and the adapter interface unchanged.

**D7 — The reference key is unique and sits outside `document`.** The API swaps references as
plain text, so a reference that happened to appear in a document's text would be replaced
there too. The key is `quepid-image-<sha256 of the bytes, truncated>`. It goes in a top-level
`state.image` key, not inside `state.document`, so `cap_state` truncation can never cut it. The
document's own `image` / `thumb` URL text stays in `state.document` as today.

**D8 — No long-context header.** `TypeSafe-Danger-Zone-Long-Context` is not sent. If an image
pushes a request over the context limit, the API returns `max_tokens_exceeded`, and
`LlmService#perform_safe_judgement` turns that into an unrateable judgement with the API's message,
like any other API error. The text cap (`MAX_STATE_CHARS`) does not account for image tokens,
because TypeSafe publishes no estimate yet.

**D9 — Fix the stored values that nobody chose.** While Jev did not support images, the form's
hidden field submitted `llm_include_images: "true"` for it (the "keep the wanted choice"
behaviour for unsupported providers). Existing Jev judges therefore have `"true"` saved without
anyone having chosen it: both Jev judges in the development database do. Flipping
`supports_images` without a fix would turn images on for all of them. A data migration sets
`llm_include_images` to `"false"` on every AI judge whose `judge_options.llm_provider` is
`typesafe_jev`. Its `down` is a no-op: before this change the switch was disabled for Jev, so no
stored value was a real choice and there is nothing to restore.

**D10 — Resize images before encoding, as a per-judge advanced setting.** Images are usually much
larger than a relevance judgement needs. A 1200 px document image costs several times the
tokens of a 300 px one, makes the request bigger, and gives Jev detail it rarely uses. So Quepid
resizes the image before base64-encoding it.

- **The setting is not Jev's.** It is a common judge option, `llm_image_dimensions`, stored in
  `judge_options` next to `llm_include_images`. It is a whole number of pixels; blank means "use
  the provider's recommended size". A base64 image is therefore always resized; there is no
  "original size" setting.
- **It goes in a new, collapsed "Advanced settings" section of the AI judge form**, a Bootstrap
  collapse below the Images row, closed by default, with a chevron that turns when it opens. The
  section also takes the settings most judges never change: LLM Model, LLM API Version and Limit to
  scales move into it from the main form; it shows for any provider once a connection is chosen.
  The image rows (image type, D11, and this one) show only for a provider with image settings to
  pick. The section opens on its own when the page is re-rendered with a validation error on any
  of its fields, so the error is never hidden. Both image fields are disabled while **Judge with
  images** is off; the dimensions field is also disabled while the image type is URL, because
  Quepid never holds the bytes then.
- **The provider sets the bounds, in code.** Each `LlmProvider` registry entry can declare
  `image_dimensions: { min:, max:, recommended: }`. For Jev: min 280, max 1568, recommended
  **300**, just above the minimum. For OpenAI: min 32, max 2048, recommended 768. These are constants in the registry, not configuration or data, because they
  come from the vendor's API limits.
- **Out-of-range values are refused, not clamped.** The form's number field gets the provider's
  `min` and `max`, and the form JavaScript swaps them when the provider changes. The browser check
  is a convenience only: `AiJudge` validates `llm_image_dimensions` against its provider's bounds on
  save, and a value below `min`, above `max`, not a whole number, or set on a provider with no
  limits is a validation error ("Image dimensions must be between 280 and 1568 px for TypeSafe
  Jev"). Silently clamping would save a value the person didn't type. Because the provider comes
  from the connection, switching a judge to a connection whose provider has different bounds
  revalidates the stored value, and the save fails until it is fixed or cleared. The adapter
  rechecks the bounds when it reads the option, and treats an out-of-range stored value (for
  example, one saved before a vendor narrowed its limits) as blank (so the recommended size) rather than sending a request
  the API would reject.
- **Blank is the recommended size, shown, not stored.** The form leaves the field empty and shows
  the provider's recommended size as its placeholder and in its hint ("Blank uses the recommended
  300 px"). Existing judges have no stored value and so get the recommended size; the D9 migration
  adds none. Storing nothing means a later change to a provider's recommended size reaches every
  judge that didn't pick its own.
- **What the size means: the shorter side.** The image is scaled so its *shorter* side equals the
  setting, keeping the aspect ratio. Scaling the longer side instead would break the minimum: a
  2:1 image scaled to 300 px wide is 150 px tall, and Jev rejects it. If the longer side would then
  exceed 1568 px (an aspect ratio above about 5:1, such as a banner), the longer side is capped at
  1568 and the shorter side ends up below the setting. If it ends up below 280, the image is
  skipped (D5).
- **Up as well as down.** An image smaller than the setting is scaled up to it. Upscaling adds no
  detail, but it lets a 150 px thumbnail through instead of skipping it: the judge sees a blurry
  image rather than none.
- **Always re-encoded as JPEG** (quality around 85). This also converts WebP, GIF and AVIF, so
  those stop being skip cases. Animated images use their first frame. Transparency is flattened
  onto white. SVG is never rendered: rasterising untrusted SVG pulls in an XML renderer for little
  gain, so SVG stays a skip case.
- **Library.** `ruby-vips` on libvips. libvips is already installed in `Dockerfile.prod` (Active
  Storage's default processor); `Dockerfile.dev` needs it added, and the Gemfile gains
  `ruby-vips`. `image_processing` is not needed for a single thumbnail call.
- **Decompression bombs.** The pixel count is read from the header bytes before decoding, and an
  image over a fixed cap (for example 50 megapixels) is skipped without being decoded. libvips
  shrinks on load (`Vips::Image.thumbnail_buffer`), so a large JPEG is never decoded at full size.
- **Explanation.** When the image was resized, nothing is added. A skip still gets D5's note.
- **Scope: any judge whose image type is base64.** Resizing needs the bytes, so it applies only
  with base64 (D11): always on Jev, and on OpenAI when the judge picks base64. The option's name,
  its meaning (the shorter side, in pixels) and the resize code are shared across providers; each
  provider declares its own bounds. Other chat providers (Anthropic, Gemini and the rest) stay
  URL-only in this change; adding base64 and bounds to one later is a registry entry plus its
  adapter's `data:` URL shape, with no new setting and no migration.

**D11 — Image type: URL or base64, a per-judge advanced setting.** How the image reaches the model
is a second setting in the Advanced section, `llm_image_type`, with two values:

- **`url`**: the document's image URL is put in the request and the provider downloads it. This is
  what chat judges do today.
- **`base64`**: Quepid downloads the image (or decodes a `data:` value, D4), applies the D5 checks
  and the D10 resize, and puts the bytes in the request.

What each provider allows is declared in code, in its `LlmProvider` registry entry, as
`image_types:` (the allowed values, the first being the default):

| Provider | `image_types` | In the form |
| --- | --- | --- |
| TypeSafe Jev | `[base64]` | Shown, **locked** to base64 (a disabled select with a hint: Jev cannot fetch URLs) |
| OpenAI | `[url, base64]` | A select, starting at URL |
| Other providers that support images | `[url]` | Not shown; URL as today |
| Providers that don't support images | none | Not shown |

- **OpenAI with base64** sends the same `image_url` content block it sends today, with a `data:`
  URL in place of the link: `{ "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }`.
  No extra header is needed. Use it when the image host is private to Quepid's network, blocks
  OpenAI's fetcher, or serves signed URLs that expire, and to resize (D10). The downloading rules
  in D5 apply: allowlist check, no redirects, its own timeout, size cap, and an image that can't be
  used is left out with a note in the explanation. OpenAI's accepted formats and size limits are
  declared on its registry entry; the exact values come from OpenAI's vision documentation when
  this is built, and are not fixed by this ADR.
- **Refused, not coerced.** `AiJudge` validates `llm_image_type` against its provider's
  `image_types` on save, like the D10 bounds: `url` on a Jev judge, or `base64` on a URL-only
  provider, is a validation error. A dimensions value with image type `url` is also refused,
  because it would silently do nothing. Switching connection to a provider that doesn't allow the
  stored type revalidates it. The adapter rechecks and falls back to the provider's default type
  for a stored value its provider no longer allows.
- **No migration.** A judge with no stored `llm_image_type` gets its provider's default: base64
  for Jev, URL for OpenAI and everyone else. Existing chat judges keep sending URLs. Jev's value is
  locked anyway.

**D12 — Image download timeout, a per-judge advanced setting.** How long Quepid waits for each
image it downloads is `llm_image_timeout`, in the Advanced settings image rows: seconds, in
tenths, 0.1–60, blank meaning the default of 0.3. Connecting gets at most 5 seconds of it. The
default is short on purpose: a run judges many pairs, and an image host that can't answer in a
third of a second costs a skip note, not a stalled run; a judge with slow hosts raises it. It applies only
when the image type is base64, the only time Quepid downloads; `AiJudge` refuses it with image
type URL, or for a provider that can't take base64, and refuses a value out of range. A download
that takes longer is skipped like any other (D5), and the pair is judged on its text.

## 3. Consequences

- **Building a request can now download an image.** With image type base64, `request_envelope`
  makes a network call (the download) before returning; until now it only assembled data. Callers
  are unchanged: `LlmService#perform_judgement` already runs it inside the call that is about to
  hit the network anyway, and a failed download is handled inside the adapter (D5), never raised.
- **A judging run gets slower and depends on image hosts.** Each pair now waits for a download. The
  download has its own timeout (D12), separate from `llm_timeout`, so a slow image host costs a few
  seconds and a skip note, not the whole call.
- **Server-side request forgery.** Quepid now fetches URLs taken from document fields. These come
  from search results, which the team controls but which can name any host. The `ProxyAllowlist`
  check blocks loopback, link-local and private addresses. Redirects are not followed, so a
  public URL cannot bounce to an internal one. The remaining gap is DNS rebinding between the check
  and the connection. The proxy has the same gap, and it is marked with a `shortcut:` comment
  rather than fixed here.
- **Cost.** Image tokens are billed as input, with no published estimate. A team turning images on
  for a large book should try a small run first and read `usage.input_tokens`.
- **A pinned model older than 1.13** gets a 400 on image requests. That becomes an unrateable
  judgement carrying the API's message. Quepid does not check the model version.
- **Reviewability.** The explanation says whether the judge saw the image: `[with document image,
  450×300]` when one was sent as base64, or `[document image not sent: <reason>; judged on text
  only]` when it was skipped. With images off, with no image on the document, or with image type
  URL, nothing is added.

## 4. Rejected

- **Multipart upload** (TypeSafe's recommendation, smaller requests). It needs `faraday-multipart`
  wired into `LlmConnection`, and a body that is no longer a hash for Jev alone. Not worth it for
  one image per request.
- **Marking a pair unrateable when its image can't be used.** Too many pairs would fail on
  ordinary thumbnails (D5).
- **Never resizing.** Without D10, ordinary thumbnails under 280 px and WebP images are skipped,
  and large images cost more tokens than a relevance judgement needs.
- **A fixed size for every judge.** Some judgements depend on detail, such as text inside an image.
  A per-judge setting lets those judges send larger images, up to the provider's maximum.
- **Sending the original size when the field is blank.** Blank would then quietly mean the most
  expensive option. Blank means the recommended size instead, and a judge that needs more detail
  sets a bigger number.
- **Scaling by the longer side.** It makes the shorter side drop below Jev's 280 px minimum for any
  non-square image (D10).
- **Default on, like the chat providers.** Because of the stored values in D9, it would quietly
  start sending images, and paying for their tokens, on existing Jev judges.
- **Always sending the long-context header with images.** TypeSafe says it is slower and less
  accurate. If needed, it should be a separate judge option.
- **Sending the image URL and letting Jev fetch it.** The API has no URL field, which is why
  Jev's image type is locked to base64 (D11).
- **Base64 for every provider by default.** It would make every existing chat judge start
  downloading images through Quepid, with new failure modes and SSRF exposure, without anyone
  choosing it. URL stays the default where the provider can fetch.
- **Deciding the image type from the provider alone, with no setting.** OpenAI judges have real
  reasons to pick either: URL is faster and costs Quepid nothing, base64 works for private or
  expiring URLs and allows resizing.

## 5. Verification (when built)

- Adapter tests (webmock, no live calls): the asset shape and header when an image is attached;
  no `assets` key and no header when the switch is off, when there is no image, and for every skip
  case in D5, each with its explanation note; a `data:` value used without a download; the note
  reset between two pairs on one adapter; the reference present in `state` exactly once.
- Image loader tests on hand-built PNG and JPEG headers: dimensions, the 280 / 1568 bounds, APNG,
  wrong magic bytes, oversize, and blocked addresses (`127.0.0.1`, `169.254.169.254`, `10.0.0.1`)
  using IP-literal URLs, so the tests need no DNS.
- Resize tests (D10) on small fixture images: the shorter side scaled to the setting, upscaling
  of a small thumbnail, the longer side capped at 1568, a banner that cannot fit skipped, WebP and
  GIF converted to JPEG, SVG skipped, an image over the pixel cap skipped without being decoded, and
  a blank setting resizing to the provider's recommended size.
- `AiJudge` validation tests: 279 and 1569 refused for Jev, 280 and 1568 accepted, blank accepted,
  a fraction refused, any value refused on a provider with no image limits, and a connection switch
  revalidating a stored value. Form JavaScript test: the field's `min`/`max` follow the provider.
- Image type (D11): `url` refused for Jev, `base64` refused for a URL-only provider, dimensions
  refused with `url`; OpenAI with base64 sends a `data:image/jpeg;base64,` URL in its `image_url`
  block, OpenAI with url or no stored value sends the link as today; the form locks Jev's select
  to base64 and offers both for OpenAI.
- The Advanced section: closed on a fresh form, open after a validation error on the field, absent
  for a provider with no limits (Playwright, with a screenshot).
- Migration test: Jev judges flipped to `"false"`, other providers untouched.
- `LlmProvider`, form JavaScript and Playwright specs updated for Jev's switch: enabled, starting
  unticked, and the choice restored on switching back.
- Manual scenarios 12.6 and 12.10 revised, and `tracking.yml` paths extended. One live call with a
  real TypeSafe key before 12.10 can be recorded as a pass.

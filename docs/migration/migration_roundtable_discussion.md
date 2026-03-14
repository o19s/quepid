# Migration Roundtable: React vs. Rails-Stimulus

A roundtable discussion among six engineering perspectives on the [React Migration Plan](react_migration_plan.md) and the [Rails-Stimulus Migration Alternative](rails_stimulus_migration_alternative.md). Each participant reviews both approaches and recommends how Quepid should proceed.

---

## Participants

- **Software Architect** — System design, consistency, long-term maintainability
- **Full Stack Engineer** — End-to-end flow, API usage, delivery
- **Frontend Engineer** — UX, components, state, modern frontend patterns
- **Ruby on Rails Engineer** — Rails conventions, server-rendered vs SPA, Hotwire
- **React Engineer** — React ecosystem, component model, hiring
- **Pragmatic Engineer** — Shipping, risk, timeline, team capacity

---

## Opening: The Two Paths

**Moderator:** Quepid needs to replace its AngularJS core. We have a detailed React migration plan and a Rails-native alternative using Stimulus and Turbo. How do you each frame the decision?

**Software Architect:** The decision is architectural: we’re choosing whether the core case-evaluation experience is a **second frontend paradigm** (React SPA inside Rails) or an **extension of the existing paradigm** (Rails + Stimulus + Turbo). The rest of the app is already ERB, Stimulus, Turbo. Adding React creates a bimodal frontend—two build pipelines, two test stacks, two mental models for “where does state live?” The Stimulus path keeps one paradigm. That’s a strong architectural argument for consistency.

**Full Stack Engineer:** I’d frame it as “how much do we reimplement on the client vs. reuse from the server?” The React plan reimplements a lot in JSX and hooks—query list, results, settings, scoring—while calling the same Rails API. The Stimulus path pushes more into server-rendered HTML and Turbo Frames, so we reuse Rails views and controllers. Same API either way; the split is where the UI is rendered and where state lives.

**Frontend Engineer:** From a frontend lens, the core workspace is **highly stateful**: multiple queries, live search, drag-and-drop, ratings, expand/collapse, modals. React is built for that. The React plan’s feature modules (query workspace, search results, settings, scoring) map cleanly to components and hooks. Stimulus can do it, but we’d be managing more state in the DOM and in small controllers—it’s a different kind of complexity. The question is whether we want a component-centric model or a “server + light JS” model for that core.

**Ruby on Rails Engineer:** Rails 8, Turbo, and Stimulus are already in the stack. The rest of Quepid—teams, books, scorers, wizards, modals—is standard Rails + Stimulus. The only SPA left is this core. So the real question is: do we **finish** the migration with the stack we’ve already standardized on, or do we **introduce** React for this one big surface? The Stimulus doc is right: adding React means two frontend paradigms. From a Rails perspective, completing the migration with Stimulus aligns the core with the rest of the app.

**React Engineer:** React gives you a single, well-understood model for complex UIs: components, hooks, clear data flow. The React plan is explicit about mapping Angular services to hooks and API modules. The ecosystem (React Router, Zustand, TanStack Query, Vitest, RTL) is mature and well-documented. The downside is we’d be the only React in the app, so we’d own a separate bundle, tests, and patterns. But for a dense, stateful workspace, React is a known quantity; Stimulus for that same surface is less common and might get messy.

**Pragmatic Engineer:** I care about: (1) Can we ship it? (2) What’s the rollback story? (3) How long do we carry two UIs? Both plans are incremental and feature-flagged, which is good. The React plan is ~5–6 months for one dev with a clear phase list. The Stimulus plan doesn’t give a number but suggests it might be “similar or shorter” because we’re not building a second full SPA. *[Assuming Phase 0 is done: splainer-search and ScorerFactory are de-risked, so the critical path is proven. Then the choice is about execution risk and long-term maintenance.]*

---

## Deep Dive: Where They Agree and Diverge

**Moderator:** Where do the two plans agree, and where do they meaningfully differ?

**Software Architect:** They agree on the important constraints: incremental migration, same Rails API, Rails as host, no feature regression, same URLs. They also agree on the hard parts: splainer-search, ScorerFactory, CSRF, HTTP/HTTPS. The divergence is **framework, routing, state, and build**. React: client-side router, Zustand/TanStack Query, dedicated React bundle and layout. Stimulus: Rails routes + Turbo, server + DOM + minimal client state, single Stimulus app. For long-term maintainability, the “one stack” story (Stimulus) is simpler; the “right tool for the job” story (React for a complex workspace) is also defensible.

**Full Stack Engineer:** The API stays the same either way—that’s a shared win. The difference is who renders the UI. With React, the client fetches JSON and renders. With Stimulus + Turbo Frames, we can have Rails actions return HTML for frames and still call the API where we need JSON. So we have more options with Stimulus (HTML or JSON), but we also have to decide frame boundaries and what’s server vs. client. With React, the boundary is clear: React owns the core UI, Rails owns the shell and API.

**Frontend Engineer:** State is the big split. In the React plan we have explicit state: Zustand for UI state, TanStack Query for server state. In the Stimulus plan we’re encouraged to keep state in the DOM and in small Stimulus values, with Turbo Frames for “what’s in this frame.” For the query workspace—many queries, live results, ratings, scoring—I’d want a clear state model. React gives that by default. With Stimulus we’d have to design it ourselves (which frame owns what, how they communicate). It’s doable but more design work.

**Ruby on Rails Engineer:** Routing is a big one. React Router means we have to keep Rails routes and React routes in sync for the core. With Turbo, Rails routes are the only source of truth; Turbo Drive and Frames just work with them. No duplicate route definitions, no “which router handled this?” The Stimulus doc is right that deep links and back/forward behave like a normal Rails app. That’s less to maintain.

**React Engineer:** The React plan has a very detailed component and hook map—Angular service to React hook, feature modules, file layout. That’s a clear migration map. The Stimulus plan says “same domains, different artifacts”—ERB + Stimulus controllers instead of React components. The domain list is the same, but the implementation style is different. If we go Stimulus, we need an equally concrete plan for “this pane is this controller, this partial, these frames,” or we’ll under-spec and drift.

**Pragmatic Engineer:** With Phase 0 complete, splainer-search and ScorerFactory are no longer blocking. Both paths can use the same API and the same de-risked search/scorer layer. So the “which is riskier?” question is now about execution: do we have a clear enough plan, and can we finish without scope creep? The React plan is very explicit (phases, components, hooks); the Stimulus plan needs to be spelled out to the same level—which controllers, which frames, which phases—or we’ll under-spec and drift.

---

## The “Islands” Option

**Moderator:** The Stimulus doc mentions possibly using React (or another library) as “islands” for one or two highly stateful areas. How do you see that?

**Software Architect:** Islands are a reasonable compromise: keep most of the core in Stimulus + Turbo, and use React only where the state and component complexity justify it—e.g. the full query workspace with drag-drop, live search, and many widgets. You still have two stacks, but the React surface is smaller and bounded. The risk is scope creep: “this part also needs React” until we’ve effectively built the full React core anyway. So if we do islands, we need a strict definition of what’s in and what’s out.

**Frontend Engineer:** I like islands for the workspace. The query list + results + settings + scoring is one interconnected surface. If we built that as one or two React roots (e.g. “workspace” + “case wizard”), we’d get React’s state and component model where it matters most. Header, case shell, maybe some modals could stay Stimulus. We’d need a clear contract at the boundary: how does the React island get bootstrap data and notify the rest of the app (e.g. URL, Turbo refresh)?

**React Engineer:** Islands work technically—we’d mount React at specific divs, pass props from the server, and use the same API. The downside is we’d still need the React toolchain, tests, and patterns for a subset of the app. So we don’t fully avoid “two stacks,” we just shrink the React surface. If we’re going to add React at all, I’d want to know why we wouldn’t just do the full React core and get a single, consistent model for the whole workspace.

**Pragmatic Engineer:** With Phase 0 done, we’re not blocked by dependencies. Islands are a fallback: if we go Stimulus and hit a wall in one area (e.g. the workspace gets too complex), we could introduce a React island there. I’d only do that if we’ve actually tried Stimulus and it’s hurting; don’t pre-optimize for islands.

---

## Testing and Delivery

**Moderator:** How do you compare the testing and delivery story of each approach?

**Full Stack Engineer:** Both rely on the same Rails API and the same system-level behavior (URLs, auth, CSRF). So system tests (Capybara) matter for both. The React plan adds Vitest + React Testing Library for unit and component tests. The Stimulus plan leans on system tests plus optional Stimulus unit tests (Jest/Vitest) with fixture DOM. For “does the app work?” system tests are the main guarantee either way. The React path gives more granular frontend tests; the Stimulus path keeps the test stack simpler.

**Ruby on Rails Engineer:** From a Rails perspective, system tests are the backbone. We already have request specs for the API. Adding RTL and React-specific tests is more to maintain. Stimulus unit tests are lighter: instantiate controller, fixture DOM, assert behavior. So the Stimulus path fits the existing testing culture better. The React path is more “frontend team” testing culture.

**Pragmatic Engineer:** With Phase 0 complete, the next priorities are: (1) System tests for critical flows (open case, run query, rate, change try/settings) so we can assert parity. (2) A clear “definition of done” per phase and a way to compare behavior to the current Angular core (e.g. visual parity or snapshot tests). Both plans mention parity; I’d make that explicit in every phase, not just at the end.

---

## Second Review: Pragmatic Engineer (Both Plans Now Similarly Detailed)

**Moderator:** The Stimulus migration doc has been expanded to match the React plan: technology choices, Rails integration and directory structure, feature modules with explicit Rails + Stimulus artifacts, migration phases 0–10 with checklists, Angular service mapping, risks, and a 5–6 month timeline. How does that change your view?

**Pragmatic Engineer:** Now both plans are **executable specs**. The Stimulus plan has the same phase order, the same domain breakdown (query workspace, search results, settings, scoring, snapshots, case management, header, document inspector, FROG), and the same timeline ballpark. The main differences are artifact types: React gives you components and hooks per feature; Stimulus gives you Rails partials/frames plus controller names and API modules. Both have a clear "done" per phase and the same risks (splainer-search, ScorerFactory, parity).

**Comparison:** (1) **Timeline** — Roughly the same (5–6 months, one dev). (2) **Execution risk** — Comparable; we have checklists for both. (3) **Long-term cost** — Stimulus keeps one stack (no second build, no RTL, no React-specific patterns to maintain). (4) **Rollback** — Both are feature-flagged; Stimulus carve-and-replace can mean smaller rollback units (one pane at a time). (5) **Team** — If the team already ships Stimulus and Turbo elsewhere in Quepid, Stimulus has no learning curve; React adds a second frontend paradigm for the core only.

So the condition I set earlier—*"the Stimulus migration must be as concrete as the React plan"*—is now satisfied. With both plans at the same level of detail, the tie-breaker is **fewer moving parts and one stack**: I still recommend **Rails-Stimulus**, and we can start Phase 1 with confidence that we have a concrete plan to follow. If we hit a wall in one area (e.g. the workspace state gets too messy in Stimulus), we can revisit React islands for that area; we don't need to pre-commit to that.

---

## Pragmatic Engineer: Main Branch vs React Migration Plan — Does the Calculus Change?

**Purpose of this section:** The roundtable above assumed a codebase where much of the app (or the migration branch) has already been moved to Rails + Stimulus. **Main** has a **lesser** implementation of Stimulus—fewer surfaces migrated, the AngularJS core still dominant. This section asks: **When we compare the main branch (with its thinner Stimulus baseline) against the [React migration plan](react_migration_plan.md), does that change the calculus** between choosing React vs Rails-Stimulus for replacing the core?

**Pragmatic Engineer:** Yes, it does—but not enough to flip the recommendation.

On **main**, the "rest of the app is already Stimulus" and "one stack" arguments are **weaker**. There's less existing Stimulus to "complete" or align with. So we're not deciding "do we finish a mostly-Stimulus app in Stimulus or add React for the last SPA?" We're deciding from an earlier state: "Do we build the replacement core in Stimulus (and grow the Stimulus surface from a thinner base) or in React (and have one React surface while the rest of the app may or may not stay thin on Stimulus)?" That **does** change the tradeoff:

- **React becomes relatively more attractive on main.** On main, React wouldn't be "the only React in an otherwise Stimulus app"—we'd be choosing the core's stack at a point where the rest of the app isn't as heavily Stimulus yet. So the "two paradigms" cost is less glaring. The [React migration plan](react_migration_plan.md) is still a full, detailed path; if we're on main and considering it, we're not fighting an existing Stimulus-heavy codebase.

- **Stimulus becomes relatively less attractive on main.** The "one stack" and "reuse existing patterns" benefits are weaker when there are fewer existing Stimulus surfaces. We'd be building more Stimulus from a thinner base, so we get less immediate payoff from consistency and pattern reuse.

So the calculus **shifts** on main: the gap between the two options narrows. React is less "obviously the odd one out"; Stimulus is less "obviously the continuation of what we've already done."

**Does that flip my recommendation?** No. I still recommend **Rails-Stimulus** even when evaluating against main. Reasons: (1) We're still choosing one stack (Stimulus) vs introducing a second (React)—and the direction of the project (migrate off Angular toward Rails + Stimulus) is unchanged, so building the core in Stimulus keeps that direction. (2) Timeline and execution risk are still comparable; the React plan doesn't get cheaper or lower-risk just because main has less Stimulus. (3) If we choose React for the core on main, we're still committing to a second frontend paradigm, build, and test stack for the long term. The "lesser Stimulus on main" softens the one-stack argument; it doesn't remove it. So: **main's lesser Stimulus implementation changes the calculus enough to make React a closer second, but not enough to change my recommendation to Stimulus.**


---

## Recommendations

Each participant’s recommended path and short rationale.

---

### Software Architect — **Recommendation: Rails-Stimulus (with optional React islands)**

**Recommendation:** Prefer the **Rails-Stimulus migration** as the default path. Use React only as **islands** if, after prototyping, one or two areas (e.g. the full query workspace) are clearly too complex for Stimulus.

**Rationale:** One frontend paradigm (Rails + Stimulus + Turbo) keeps the system easier to reason about and maintain. Two paradigms (Rails + React + Stimulus) increase cognitive load, onboarding cost, and the chance of inconsistent patterns. The Stimulus doc correctly identifies that the rest of Quepid is already server-rendered + Stimulus; completing the migration with the same stack aligns the core with the rest of the architecture. If a bounded part of the core genuinely needs a component-heavy model, introduce React there as an island with a clear boundary, rather than a full second SPA.

---

### Full Stack Engineer — **Recommendation: Rails-Stimulus first; re-evaluate after Phase 2**

**Recommendation:** Start with the **Rails-Stimulus approach**. Plan to re-evaluate after Phase 2 (query list and basic workspace). If the Stimulus implementation is clean and fast to iterate on, continue. If it’s getting brittle or slow, consider introducing React for the workspace only (islands) or pausing to reassess.

**Rationale:** The same API and the same Rails host mean both paths are feasible. The variable is how much complexity we push to the client. Starting with Stimulus + Turbo lets us reuse server-rendered HTML and avoid a second build and test stack. If the query list and early workspace feel good in Stimulus, we continue; if we hit limits (state, re-renders, frame boundaries), we have a natural checkpoint to introduce React in a bounded way. That keeps options open without committing to a full React migration up front.

---

### Frontend Engineer — **Recommendation: React for the core workspace**

**Recommendation:** Use the **React migration plan** for the core case-evaluation workspace. Treat the workspace (query list, results, rating, settings, scoring) as a single React app inside the Rails shell; keep header and other chrome in Rails/Stimulus if desired.

**Rationale:** The core is a dense, stateful UI. React’s component and hook model, plus Zustand and TanStack Query, give a clear, well-known way to manage that. The React plan’s feature modules and service-to-hook mapping are a concrete migration map. Stimulus can work, but we’d be designing state and frame boundaries from scratch, and the team would need to be comfortable with “server + DOM + minimal client state” for a complex surface. If the team has or can get React skills, the React path reduces frontend design risk and gives better long-term structure for that core.

---

### Ruby on Rails Engineer — **Recommendation: Rails-Stimulus (full divergence)**

**Recommendation:** Follow the **Rails-Stimulus migration alternative** and **do not** introduce React. Keep one layout, one Stimulus app, Rails routes, and Turbo for the core. Replace the Angular core piece by piece with ERB + Stimulus (+ Turbo Frames).

**Rationale:** The app is already Rails 8 + Stimulus + Turbo everywhere except this core. Adding React creates a second frontend stack, a second layout, and a second router to keep in sync. The Stimulus doc’s divergence table is right: same domains, same API, same risks; only the implementation (ERB + Stimulus vs. React) changes. Finishing the migration with the stack we’ve already chosen keeps the codebase consistent, simplifies onboarding, and avoids maintaining two frontend paradigms indefinitely. The Rails way is to use the server and Turbo; the core can be “more of the same.”

---

### React Engineer — **Recommendation: Full React migration (as planned)**

**Recommendation:** Proceed with the **React migration plan** as written: React 19, React Router, Zustand/TanStack Query, the stated feature modules and phases, and a single React core behind a feature flag.

**Rationale:** For a complex, stateful workspace, React is a proven fit. The plan is detailed, the ecosystem is mature, and the mapping from Angular to React is explicit. Yes, we’d have a separate React bundle and tests, but we’d have one clear model for the entire core instead of a mix of server-rendered frames and Stimulus controllers that we have to design ourselves. Hiring and documentation are easier with React. The main dependency is fixing splainer-search; that’s framework-agnostic. So the recommendation is: do the framework-agnostic work first, then build the core in React and remove Angular.

---

### Pragmatic Engineer — **Recommendation: Rails-Stimulus (Phase 0 complete; both plans now equally detailed)**

**Recommendation:** **Assume Phase 0 is complete.** With the [Rails-Stimulus migration plan](rails_stimulus_migration_alternative.md) now as detailed as the [React migration plan](react_migration_plan.md) (phases 0–10, feature modules with artifacts, Angular mapping, timeline), **proceed with the Rails-Stimulus path.**

**Rationale (unchanged):** One stack, carve-and-replace, no new framework, same API and risks. The **condition** previously set—that the Stimulus plan be as concrete as the React plan—is now met: we have phase checklists, controller/view artifact lists per feature, and a 5–6 month estimate. Execution risk is comparable for both paths; the tie-breaker is long-term cost and team fit. Stimulus keeps one frontend paradigm and avoids maintaining a React bundle and React-specific tests for the core only. If we hit a wall in one area, we can still consider a React island there; no need to pre-commit.

---

## Summary Table

| Role                 | Recommended path                          | Main reason                                                                 |
|----------------------|-------------------------------------------|-----------------------------------------------------------------------------|
| Software Architect   | Rails-Stimulus (React islands if needed)  | One paradigm; consistency; optional React only where complexity justifies it. |
| Full Stack Engineer  | Rails-Stimulus; re-evaluate after Phase 2 | Reuse server and API; keep option to add React later if Stimulus hits limits. |
| Frontend Engineer    | React for core workspace                  | Dense stateful UI; React’s component/hook model and migration map are clearer. |
| Ruby on Rails Engineer | Rails-Stimulus (full)                   | Align core with rest of app; avoid second stack and duplicate routing.       |
| React Engineer       | Full React migration                      | Best fit for complex workspace; explicit plan and ecosystem.                 |
| Pragmatic Engineer   | Rails-Stimulus (both plans now equally detailed) | One stack, carve-and-replace; Stimulus plan now has phases/artifacts/timeline—execution risk comparable, recommend Stimulus. *Separate section: [Main branch vs React migration plan](#pragmatic-engineer-main-branch-vs-react-migration-plan--does-the-calculus-change)—does main's lesser Stimulus change the calculus? Yes (narrows the gap, React a closer second); recommendation still Stimulus.* |

---

## Suggested Next Steps

1. **Phase 0:** Implement or wrap splainer-search to use `fetch` and native Promises; optionally spike ScorerFactory. Add feature flag and shared API client. Document findings.
2. **Decision:** With both the [React](react_migration_plan.md) and [Rails-Stimulus](rails_stimulus_migration_alternative.md) plans equally detailed, choose by team context: one stack (Stimulus) vs. component-centric model (React). Consider “re-evaluate after Phase 2” and “React islands” if choosing Stimulus.
3. **Execute:** Follow the chosen plan’s phase checklists; both include Phase 0–10, feature modules, and Angular mapping.
4. **Parity and rollback:** Define “done” per phase and assert parity (e.g. system tests, key user flows); use the feature flag for rollback before removing Angular.

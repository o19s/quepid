# CSS Variables

Quepid uses shared CSS custom properties (variables) for consistent spacing, colors, and borders across the application.

## Source

Variables are defined in `app/assets/stylesheets/variables.css` and loaded early in all CSS bundles (application, core, admin) via `build_css.js`.

## Variable Reference

### Spacing

Spacing uses a **step-based scale**: the number is a design token index, not a pixel value. Values can change without renaming.

| Step | Variable | Value | Use |
|------|----------|-------|-----|
| 0 | `--quepid-spacing-0` | 2px | Tight gaps, icon margins |
| 1 | `--quepid-spacing-1` | 4px | Compact gaps |
| 2 | `--quepid-spacing-2` | 5px | Small padding |
| 3 | `--quepid-spacing-3` | 6px | Small elements |
| 4 | `--quepid-spacing-4` | 8px | In-between padding |
| 5 | `--quepid-spacing-5` | 10px | Default padding |
| 6 | `--quepid-spacing-6` | 12px | Tooltip/button padding |
| 7 | `--quepid-spacing-7` | 15px | Section padding |
| 8 | `--quepid-spacing-8` | 18px | Navbar padding |
| 9 | `--quepid-spacing-9` | 20px | Block margins |
| 10 | `--quepid-spacing-10` | 24px | Indent, inline results |
| 11 | `--quepid-spacing-11` | 30px | Large section spacing |
| 12 | `--quepid-spacing-12` | 32px | Toggle buttons |
| 13 | `--quepid-spacing-13` | 40px | Profile margins |
| 14 | `--quepid-spacing-14` | 48px | Collapsed panel width |
| 15 | `--quepid-spacing-15` | 50px | Results margin |
| 16 | `--quepid-spacing-16` | 80px | Flash padding |
| 17 | `--quepid-spacing-17` | 100px | Tooltip min-width |

**Semantic aliases** (prefer steps in new code):

| Alias | Maps to |
|-------|---------|
| `--quepid-spacing-xs` | `--quepid-spacing-0` |
| `--quepid-spacing-sm` | `--quepid-spacing-2` |
| `--quepid-spacing-md` | `--quepid-spacing-5` |
| `--quepid-spacing-lg` | `--quepid-spacing-7` |
| `--quepid-spacing-xl` | `--quepid-spacing-9` |
| `--quepid-spacing-xxl` | `--quepid-spacing-11` |

### Breakpoints

Breakpoints align with Bootstrap 5. Use in media queries; the build resolves `var()` to pixel values (CSS does not support `var()` in media queries natively).

| Variable | Value | Use |
|----------|-------|-----|
| `--quepid-breakpoint-sm` | 576px | min-width (sm and up) |
| `--quepid-breakpoint-sm-max` | 575.98px | max-width (below sm) |
| `--quepid-breakpoint-md` | 768px | min-width (md and up) |
| `--quepid-breakpoint-md-max` | 767.98px | max-width (below md) |
| `--quepid-breakpoint-lg` | 992px | min-width (lg and up) |
| `--quepid-breakpoint-lg-max` | 991.98px | max-width (below lg) |
| `--quepid-breakpoint-xl` | 1200px | min-width (xl and up) |
| `--quepid-breakpoint-xl-max` | 1199.98px | max-width (below xl) |
| `--quepid-breakpoint-xxl` | 1400px | min-width (xxl and up) |
| `--quepid-breakpoint-xxl-max` | 1399.98px | max-width (below xxl) |

```css
@media (max-width: var(--quepid-breakpoint-md-max)) {
  .my-component { flex-direction: column; }
}
@media (min-width: var(--quepid-breakpoint-md)) {
  .my-component { flex-direction: row; }
}
```

### Border Radius

| Variable | Value |
|----------|-------|
| `--quepid-border-radius-xs` | 2px |
| `--quepid-border-radius-sm` | 4px |
| `--quepid-border-radius-md` | 5px |
| `--quepid-border-radius-lg` | 6px |
| `--quepid-border-radius-xl` | 10px |

### Border Width

| Variable | Value |
|----------|-------|
| `--quepid-border-width` | 1px |
| `--quepid-border-width-thick` | 2px |
| `--quepid-border-width-medium` | 3px |
| `--quepid-highlight-width` | 4px |

### Typography

| Variable | Value | Use |
|----------|-------|-----|
| `--quepid-font-size-2xs` | 0.5rem | Tiny labels, loading text |
| `--quepid-font-size-3xs` | 0.625rem | 10px, graph labels |
| `--quepid-font-size-xs` | 0.7rem | Small labels, captions |
| `--quepid-font-size-xs-2` | 0.75rem | 12px, JSON tree toggle |
| `--quepid-font-size-sm` | 0.85rem | Secondary text |
| `--quepid-font-size-sm-2` | 0.875rem | 14px equivalent, nav links |
| `--quepid-font-size-base` | 1rem | Body text |
| `--quepid-font-size-md` | 1.1rem | Emphasized body |
| `--quepid-font-size-lg` | 1.25rem | Subheadings |
| `--quepid-font-size-lg-2` | 1.375rem | 22px, qscore ratings |
| `--quepid-font-size-xl` | 1.5rem | Headings |
| `--quepid-font-size-2xl` | 1.75rem | Large headings, navbar brand |
| `--quepid-font-size-3xl` | 2rem | Hero headings |
| `--quepid-font-size-4xl` | 4rem | Large icons, loading spinner |

### Motion / Duration

| Variable | Value | Use |
|----------|-------|-----|
| `--quepid-duration-instant` | 0ms | No transition |
| `--quepid-duration-fast` | 150ms | Quick feedback (hover, focus) |
| `--quepid-duration-base` | 200ms | Default transitions |
| `--quepid-duration-moderate` | 300ms | Slower animations |

```css
.my-component {
  font-size: var(--quepid-font-size-md);
  transition: background var(--quepid-duration-fast) ease;
}
```

### Colors

| Variable | Purpose |
|----------|---------|
| `--quepid-color-border` | Default borders (#dee2e6) |
| `--quepid-color-border-light` | Light borders (#eee) |
| `--quepid-color-border-lighter` | Lighter borders (#f0f0f0) |
| `--quepid-color-border-dd` | Medium borders (#ddd) |
| `--quepid-color-bg-subtle` | Subtle backgrounds (#f8f9fa) |
| `--quepid-color-bg-hover` | Hover backgrounds (#eee) |
| `--quepid-color-bg-muted` | Muted backgrounds (#ccc) |
| `--quepid-color-white` | White (#fff) |
| `--quepid-color-text` | Primary text (#222) |
| `--quepid-color-text-dark` | Dark text (#333) |
| `--quepid-color-text-muted` | Muted text (#666) |
| `--quepid-color-text-light` | Light text (#888) |
| `--quepid-color-text-light-2` | Lighter gray (#999) |
| `--quepid-color-text-lighter` | Lighter text (#aaa) |
| `--quepid-color-text-darker` | Darker text/borders (#444) |
| `--quepid-color-black` | Black (#000) |
| `--quepid-color-success` | Success state (#198754) |
| `--quepid-color-success-bg` | Success background (#d1e7dd) |
| `--quepid-color-success-hover` | Success hover (#449d44) |
| `--quepid-color-success-hover-border` | Success hover border (#398439) |
| `--quepid-color-success-alt` | Success variant (#5cb85c) |
| `--quepid-color-danger` | Danger/error (#dc3545) |
| `--quepid-color-danger-dark` | Danger dark (#a94442) |
| `--quepid-color-danger-bg` | Danger background (#f8d7da) |
| `--quepid-color-warning` | Warning (#ffc107) |
| `--quepid-color-info` | Info/primary (#0d6efd) |
| `--quepid-color-info-bg` | Info background (#cfe2ff) |
| `--quepid-color-info-light` | Info light/loading (#4db7f9) |
| `--quepid-color-info-hover` | Info hover (#337ab7) |
| `--quepid-color-info-hover-border` | Info hover border (#2e6da4) |
| `--quepid-color-json-key` | JSON tree key (#881391) |
| `--quepid-color-json-string` | JSON tree string (#0b7285) |
| `--quepid-color-json-number` | JSON tree number (#1864ab) |
| `--quepid-color-json-boolean` | JSON tree boolean (#c92a2a) |
| `--quepid-color-neutral` | Neutral gray (#6c757d) |
| `--quepid-color-neutral-dark` | Neutral dark (#495057) |
| `--quepid-color-neutral-bg` | Neutral background (#e9ecef) |
| `--quepid-color-footer-bg` | Footer background (#0a4275) |
| `--quepid-color-brand-gradient-top` | Navbar/footer gradient top (#4f8ecc) |
| `--quepid-color-brand-gradient-bottom` | Navbar/footer gradient bottom (#2774c0) |
| `--quepid-color-brand-solid` | Navbar secondary solid (#369) |
| `--quepid-color-profile-text` | Profile page text (#2b2a2a) |
| `--quepid-color-profile-bg-muted` | Profile page muted background (#efefef) |
| `--quepid-color-profile-hero-bg` | Profile page hero section background (#9de2ff) |
| `--quepid-color-signup-heading` | Signup page h2/h3 (#036) |
| `--quepid-color-rating` | Workspace rating badge (#db918f) |
| `--quepid-color-qgraph-stroke` | QGraph chart line stroke (#558877) |
| `--quepid-color-qgraph-axis` | QGraph axis lines (#d3d3d3) |
| `--quepid-color-qgraph-marker` | QGraph marker line (#0000ff) |
| `--quepid-color-sidebar-icon` | Sidebar nav icon inactive (#6495ed) |

## Usage

```css
.my-component {
  padding: var(--quepid-spacing-5) var(--quepid-spacing-7);
  /* or semantic: var(--quepid-spacing-md) var(--quepid-spacing-lg) */
  border: var(--quepid-border-width) solid var(--quepid-color-border);
  border-radius: var(--quepid-border-radius-md);
  color: var(--quepid-color-text);
}
```

Prefer step-based variables (`--quepid-spacing-1` through `--quepid-spacing-17`) in new code; semantic aliases remain for compatibility.

## QScore Aliases

`qscore.css` defines aliases for backwards compatibility. Prefer the shared `--quepid-*` variables in new code:

- `--qscore-spacing-*` → `var(--quepid-spacing-*)`
- `--qscore-border-radius` → `var(--quepid-border-radius-md)`
- `--qscore-border-width` → `var(--quepid-border-width)`

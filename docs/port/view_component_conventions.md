# ViewComponent Conventions

This document describes how we use [ViewComponent](https://viewcomponent.org/) in Quepid. Follow these conventions when adding or changing components.

**Related documentation:**
- [UI Consistency Patterns](ui_consistency_patterns.md) — Bootstrap 5, modals, flash messages
- [Turbo Streams Guide](turbo_streams_guide.md) — When and how to use Turbo Streams
- [Turbo Frame Boundaries](turbo_frame_boundaries.md) — Frame structure and boundaries
- [App Structure](../app_structure.md) — Overall frontend architecture

---

## Location and base class

- **Directory:** All ViewComponents live under `app/components/`.
- **Base class:** Every component must inherit from `ApplicationComponent` (defined in `app/components/application_component.rb`). Do not subclass `ViewComponent::Base` directly.

Example:

```ruby
# app/components/example_component.rb
class ExampleComponent < ApplicationComponent
  def initialize(title:)
    @title = title
  end
end
```

---

## Where to render components

- **Prefer views:** Use `render Component.new(...)` in ERB views (or other view templates). This keeps presentation in the view layer and makes components easy to locate and reuse.
- **Controllers:** Avoid `render(Component.new(...))` in controllers unless you have a clear reason (e.g. rendering a component as the only response in a custom action). Default to rendering components from views.

In a view:

```erb
<%= render ExampleComponent.new(title: "My Title") %>
```

---

## Naming

- **Suffix:** Component classes are named with the `Component` suffix.
- **Pattern:** `{FeatureOrConcept}{Component}` — e.g. `CaseCardComponent`, `QueryListComponent`, `JudgementsPanelComponent`, `ExportCaseModalComponent`.
- **File and class:** The file is `snake_case_component.rb` and the class is `PascalCaseComponent` (e.g. `case_card_component.rb` → `CaseCardComponent`).

When naming a new component, choose a name that describes the UI piece or concept, not the page it appears on.

---

## Documentation

Document components with YARD-style comments. Include:
- A brief description of what the component renders
- `@param` tags for each `initialize` parameter with type and description
- `@see` references to related documentation

Example:

```ruby
# frozen_string_literal: true

# Renders a "Delete query" trigger and confirmation modal for a single query row.
# Replaces the Angular delete-query behavior. Submit is handled by the delete_query
# Stimulus controller, which sends DELETE to case/:id/queries/:query_id (Turbo Stream)
# or api/cases/:id/queries/:query_id (JSON fallback).
#
# @see docs/view_component_conventions.md
class DeleteQueryComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API
  # @param query_id [Integer] Query id to delete
  # @param query_text [String] Query text for confirmation message (truncated)
  # @param try_number [Integer, nil] Try number for redirect after delete
  # @param selected_query_id [Integer, nil] When present and equal to query_id, server clears results pane
  def initialize case_id:, query_id:, query_text:, try_number: nil, selected_query_id: nil
    @case_id           = case_id
    @query_id          = query_id
    @query_text        = query_text.to_s.truncate(50)
    @try_number        = try_number
    @selected_query_id = selected_query_id
  end
end
```

---

## Component templates

- **Location:** Template files live alongside the component class: `app/components/{component_name}.html.erb`.
- **File header:** Start templates with a comment describing what the component renders and any important context (e.g. Turbo Frame wrapping, Stimulus controller usage).

Example:

```erb
<%# Query list for case/try workspace. Each row: query text, score, Move/Options/Explain. %>
<%# Wrapped in Turbo Frame so the region can be updated via Turbo Streams (e.g. add/remove/reorder queries). %>
<%# Each query row has a unique turbo-frame id (query_row_<id>) for targeted Turbo Stream updates. %>
<%= helpers.turbo_frame_tag "query_list_#{@case_id}" do %>
  <%# component content %>
<% end %>
```

---

## Stimulus controller integration

Components often work with Stimulus controllers to add interactive behavior. Common patterns:

### Pattern 1: Component wrapper with Stimulus controller

When a component needs a Stimulus controller that manages both trigger and modal/content, wrap everything in a container div with the controller:

```erb
<%# Wrapper so Stimulus has access to both trigger and modal. %>
<div
  class="delete-query-wrapper"
  data-controller="delete-query"
  data-delete-query-case-id-value="<%= @case_id %>"
  data-delete-query-query-id-value="<%= @query_id %>"
>
  <button type="button" class="btn btn-default btn-sm" data-action="click->delete-query#open">
    Delete
  </button>
  <div class="modal fade" id="deleteQueryModal-<%= @query_id %>" data-delete-query-target="modal">
    <%# modal content %>
  </div>
</div>
```

**Use when:** The component includes both a trigger (button, link) and related content (modal, dropdown) that the Stimulus controller manages together.

### Pattern 2: Component root element as Stimulus controller

When the component itself is the interactive region, attach the Stimulus controller to the root element:

```erb
<div class="results-pane" 
     data-controller="results-pane" 
     data-results-pane-case-id-value="<%= @case_id %>"
     data-results-pane-query-id-value="<%= @query_id %>">
  <%# component content with targets and actions %>
</div>
```

**Use when:** The entire component is an interactive region (e.g. results pane that fetches data, query list with sorting/filtering).

### Pattern 3: Nested components with separate controllers

Components can render other components, each with their own Stimulus controllers:

```erb
<div data-controller="query-list">
  <% @queries.each do |query| %>
    <%= render DeleteQueryComponent.new(case_id: @case_id, query_id: query.id, ...) %>
  <% end %>
</div>
```

**Use when:** Building composite UIs where each piece has its own behavior.

### Data attributes

- **Values:** Pass data to Stimulus controllers via `data-{controller-name}-{value-name}-value`. Use JSON for complex data: `data-results-pane-scale-value="<%= @scorer_scale.to_json %>"`.
- **Targets:** Mark elements as targets with `data-{controller-name}-target="{target-name}"`.
- **Actions:** Wire up events with `data-action="{event}->{controller}#{method}"`.

See [UI Consistency Patterns](ui_consistency_patterns.md) for modal patterns and Bootstrap 5 conventions.

---

## Component previews (optional)

Previews let you develop and inspect components in the browser at `/rails/view_components` (when `config.view_component.show_previews` is enabled in development).

- **Location:** Preview classes live in `test/components/previews/`.
- **Naming:** `{ComponentName}Preview` in a file `{component_name}_preview.rb` (e.g. `example_component_preview.rb` → `ExampleComponentPreview`).
- **When to add:** Add previews for key or complex components so designers and developers can iterate without going through full app flows.

Example preview:

```ruby
# test/components/previews/example_component_preview.rb
class ExampleComponentPreview < ViewComponent::Preview
  def default
    render(ExampleComponent.new(title: "Example Title"))
  end
end
```

---

## Slots and content blocks

Use slots for flexible composition when a component needs to accept variable content from the caller.

- **`renders_one`** — for a single optional block (e.g. header, empty state, custom content area)
- **`renders_many`** — for multiple blocks (e.g. list items)

Example:

```ruby
# app/components/results_pane_component.rb
class ResultsPaneComponent < ApplicationComponent
  renders_one :results_content
end
```

In the template, check for the slot with `results_content?` and render with `results_content`. The caller passes content via `component.with_results_content { ... }` when rendering:

```erb
<%= render ResultsPaneComponent.new(...) do |component| %>
  <% component.with_results_content do %>
    <%= render MatchesComponent.new(...) %>
  <% end %>
<% end %>
```

---

## Turbo Frames

When a component wraps a region that will be updated via Turbo Streams (e.g. query list, results pane), wrap the content in a Turbo Frame so the server can target updates. See [turbo_streams_guide.md](turbo_streams_guide.md) for Turbo Stream patterns.

```erb
<%= helpers.turbo_frame_tag "query_list_#{@case_id}" do %>
  <%# component content %>
<% end %>
```

**Important:** Use `helpers.` prefix for view helpers (e.g. `turbo_frame_tag`, `link_to`, `form_with`) in component templates so they work in tests and previews.

---

## View helpers

Always use the `helpers.` prefix when calling Rails view helpers in component templates:

```erb
<%= helpers.link_to "Home", root_path %>
<%= helpers.form_with url: some_path do |f| %>
  <%# form %>
<% end %>
<%= helpers.turbo_frame_tag "my_frame" do %>
  <%# content %>
<% end %>
```

This ensures helpers work correctly in component tests and previews, where the view context may differ from regular ERB templates.

---

## Common patterns

### Modals

Components that render modals follow one of these patterns (see [UI Consistency Patterns](ui_consistency_patterns.md) for details):

- **Per-component modal:** Component wraps trigger + modal; Stimulus opens via `window.bootstrap.Modal.getOrCreateInstance`. Example: `DeleteQueryComponent`, `QueryOptionsComponent`.
- **Shared modal:** Component renders trigger; shared partial contains modal; Stimulus populates on open. Example: `ShareCaseComponent`.
- **Expand content:** Full-screen modal for large content. Example: `ExpandContentComponent`.

### Forms

Forms in components submit via Turbo Frames or Turbo Streams to avoid full-page reloads. Use `helpers.form_with` with `local: false` or Turbo Frame wrapping.

### Empty states

Use slots to allow callers to customize empty states:

```ruby
class QueryListComponent < ApplicationComponent
  renders_one :empty_state
end
```

```erb
<% if @queries.empty? %>
  <% if empty_state? %>
    <%= empty_state %>
  <% else %>
    <p class="text-muted">No queries yet.</p>
  <% end %>
<% end %>
```

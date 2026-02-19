# ViewComponent Conventions

This document describes how we use [ViewComponent](https://viewcomponent.org/) in Quepid. Follow these conventions when adding or changing components.

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

## Where to render components

- **Prefer views:** Use `render Component.new(...)` in ERB views (or other view templates). This keeps presentation in the view layer and makes components easy to locate and reuse.
- **Controllers:** Avoid `render(Component.new(...))` in controllers unless you have a clear reason (e.g. rendering a component as the only response in a custom action). Default to rendering components from views.

In a view:

```erb
<%= render ExampleComponent.new(title: "My Title") %>
```

## Naming

- **Suffix:** Component classes are named with the `Component` suffix.
- **Pattern:** `{FeatureOrConcept}{Component}` — e.g. `CaseCardComponent`, `QueryListComponent`, `JudgementsPanelComponent`, `ExportCaseModalComponent`.
- **File and class:** The file is `snake_case_component.rb` and the class is `PascalCaseComponent` (e.g. `case_card_component.rb` → `CaseCardComponent`).

When naming a new component, choose a name that describes the UI piece or concept, not the page it appears on.

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

In the template, check for the slot with `results_content?` and render with `results_content`. The caller passes content via `component.with_results_content { ... }` when rendering.

## Turbo Frames

When a component wraps a region that will be updated via Turbo Streams (e.g. query list, results pane), wrap the content in a Turbo Frame so the server can target updates. See [turbo_streams_guide.md](turbo_streams_guide.md) for Turbo Stream patterns.

```erb
<%= helpers.turbo_frame_tag "query_list" do %>
  <%# component content %>
<% end %>
```

Use `helpers.` prefix for view helpers (e.g. `turbo_frame_tag`) in component templates so they work in tests and previews.

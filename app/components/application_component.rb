# frozen_string_literal: true

# Base class for all ViewComponents in Quepid. All components must inherit from this class.
# Add shared behavior (e.g. helpers, defaults) here so all components inherit it.
#
# Conventions: docs/view_component_conventions.md
# See also: https://viewcomponent.org/guide/getting-started.html
class ApplicationComponent < ViewComponent::Base
end

# frozen_string_literal: true

Ransack.configure do |config|
  # Small Bootstrap Icons glyphs instead of Ransack's default Unicode
  # triangles, matching the icon vocabulary already used elsewhere (bi-
  # search-heart, bi-lock-fill, etc). Only ever shown on the currently-
  # sorted column - Ransack already omits it entirely for unsorted columns.
  #
  # Confusingly, Ransack's `up_arrow` is what's shown when the column is
  # sorted *descending* (and vice versa for `down_arrow`) - verified by
  # testing, not assumed, since the gem's own default values are swapped the
  # same way (up_arrow's default '&#9660;' is actually a down-pointing
  # triangle). These are assigned to match what they visually look like, not
  # what Ransack calls them.
  config.options[:up_arrow] = '<i class="bi bi-caret-down-fill"></i>'
  config.options[:down_arrow] = '<i class="bi bi-caret-up-fill"></i>'
end

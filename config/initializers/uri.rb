# frozen_string_literal: true

# config/initializers/uri.rb

# Ruby 3 got rid of this method, however the Gabba gem requires it.  Monkeypatch for now ;-(.

module URI
  def self.escape *args
    DEFAULT_PARSER.escape(*args)
  end
end

# frozen_string_literal: true

if defined? Rack::MiniProfiler
  # Do not let rack-mini-profiler disable caching
  Rack::MiniProfiler.config.disable_caching = false # defaults to true
end

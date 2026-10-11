# frozen_string_literal: true

# One adapter per API dialect an Embedder can speak. Each subclass of
# EmbedderAdapters::Base knows only how to shape a request for a batch of texts and how
# to read vectors back out of the response; batching, templating, truncation and the
# HTTP call itself are shared.
module EmbedderAdapters
  # Raised for anything that means "no usable vectors": an HTTP error, a response in the
  # wrong shape, or vectors of the wrong length.
  class Error < StandardError; end
end

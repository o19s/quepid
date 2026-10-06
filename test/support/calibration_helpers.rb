# frozen_string_literal: true

module ActiveSupport
  class TestCase
    # Adds count pairs to book, each rated by reference, alternating the
    # book's lowest and highest grades. Enough pairs to clear
    # CalibrationSample::MIN_SIZE by default.
    def rate_pairs_for_calibration book, reference, count: CalibrationSample::MIN_SIZE + 5
      low, high = book.scale.minmax
      Array.new(count) do |i|
        pair = book.query_doc_pairs.create!(query_text: "calibration #{i}", doc_id: "calibration_doc_#{i}", position: 1)
        pair.judgements.create!(user: reference, rating: i.even? ? low : high)
        pair
      end
    end

    # Adds queries whole top lists of depth pairs, every pair rated by
    # reference with grades cycling through the book's scale. Returns the
    # pairs, grouped by query.
    def rate_queries_for_calibration book, reference, queries: CalibrationSample::MIN_QUERIES + 2, depth: 10
      scale = book.scale
      Array.new(queries) do |q|
        Array.new(depth) do |position|
          pair = book.query_doc_pairs.create!(query_text: "calibration query #{q}", doc_id: "doc_#{q}_#{position}",
                                              position: position)
          pair.judgements.create!(user: reference, rating: scale[(q + position) % scale.size])
          pair
        end
      end
    end
  end
end

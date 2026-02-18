# frozen_string_literal: true

# Preview for FrogReportComponent. View at /rails/view_components in development.
class FrogReportComponentPreview < ViewComponent::Preview
  def default
    render(
      FrogReportComponent.new(
        case_id: 1,
        case_name: "Sample Case",
        queries_count: 5,
        book_id: nil,
        book_name: nil,
        depth: 10,
        all_rated: false,
        rating_stats: [
          { query_id: 1, ratings_count: 10 },
          { query_id: 2, ratings_count: 7 },
          { query_id: 3, ratings_count: 0 },
          { query_id: 4, ratings_count: 10 },
          { query_id: 5, ratings_count: 5 }
        ]
      )
    )
  end

  def with_book
    render(
      FrogReportComponent.new(
        case_id: 1,
        case_name: "Case with Book",
        queries_count: 3,
        book_id: 7,
        book_name: "My Book",
        depth: 10,
        all_rated: false,
        rating_stats: [
          { query_id: 1, ratings_count: 10 },
          { query_id: 2, ratings_count: 3 },
          { query_id: 3, ratings_count: 0 }
        ]
      )
    )
  end

  def all_rated
    render(
      FrogReportComponent.new(
        case_id: 1,
        case_name: "Fully Rated Case",
        queries_count: 2,
        book_id: nil,
        book_name: nil,
        depth: 10,
        all_rated: true,
        rating_stats: [
          { query_id: 1, ratings_count: 10 },
          { query_id: 2, ratings_count: 10 }
        ]
      )
    )
  end
end

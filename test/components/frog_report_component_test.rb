# frozen_string_literal: true

require 'test_helper'

class FrogReportComponentTest < ViewComponent::TestCase
  def default_params
    {
      case_id:       42,
      case_name:     'My Case',
      queries_count: 5,
      book_id:       nil,
      book_name:     nil,
      depth:         10,
      all_rated:     false,
      rating_stats:  [
        { query_id: 1, ratings_count: 10 },
        { query_id: 2, ratings_count: 7 },
        { query_id: 3, ratings_count: 0 },
        { query_id: 4, ratings_count: 10 },
        { query_id: 5, ratings_count: 5 }
      ],
    }
  end

  def test_renders_trigger_and_modal
    render_inline(FrogReportComponent.new(**default_params))

    assert_selector ".frog-report-wrapper[data-controller='frog-report']"
    assert_selector "[data-frog-report-case-id-value='42']"
    assert_selector "a[data-action='click->frog-report#open']"
    assert_selector '#frogReportModal-42.modal'
    assert_selector '.modal-title', text: /The Frog Pond Report: My Case/
    assert_text 'You have 5 Queries for this case'
  end

  def test_summary_stats
    render_inline(FrogReportComponent.new(**default_params))

    # 1 query with 0 ratings
    assert_text 'only one returns'
    assert_text 'zero'
    # Total needed: 5 * 10 = 50
    assert_text '50 ratings'
    # Missing: (0 + 3 + 10 + 0 + 5) = 18
    assert_text '18 ratings missing'
  end

  def test_all_rated_shows_congratulations
    params = default_params.merge(all_rated: true)
    render_inline(FrogReportComponent.new(**params))

    assert_text 'Congratulations'
    assert_no_text 'ratings missing'
  end

  def test_no_refresh_button_without_book
    render_inline(FrogReportComponent.new(**default_params))

    assert_no_selector "[data-frog-report-target='refreshBtn']"
  end

  def test_refresh_button_with_book
    params = default_params.merge(book_id: 7, book_name: 'My Book')
    render_inline(FrogReportComponent.new(**params))

    assert_selector "[data-frog-report-target='refreshBtn']"
    assert_text 'Refresh ratings from book'
    assert_text 'My Book'
  end

  def test_chart_data_value_present
    render_inline(FrogReportComponent.new(**default_params))

    assert_selector '[data-frog-report-chart-data-value]'
  end

  def test_hop_to_it_when_missing_rate_over_5
    render_inline(FrogReportComponent.new(**default_params))

    # Missing rate = 18/50 = 36% > 5%
    assert_text 'So hop to it!'
  end

  def test_chart_data_json_distribution
    component = FrogReportComponent.new(**default_params)
    data = JSON.parse(component.chart_data_json)

    # depth=10, ratings: [10, 7, 0, 10, 5]
    # missing: [0, 3, 10, 0, 5]
    # distribution: 0 => 2 ("Fully Rated"), 3 => 1 ("Missing 3"), 5 => 1 ("Missing 5"), 10 => 1 ("No Ratings")
    assert_equal 4, data.length
    assert_equal({ 'category' => 'Fully Rated', 'amount' => 2 }, data[0])
    assert_equal({ 'category' => 'Missing 3', 'amount' => 1 }, data[1])
    assert_equal({ 'category' => 'Missing 5', 'amount' => 1 }, data[2])
    assert_equal({ 'category' => 'No Ratings', 'amount' => 1 }, data[3])
  end

  def test_zero_queries
    params = default_params.merge(queries_count: 0, rating_stats: [])
    component = FrogReportComponent.new(**params)

    assert_equal 0, component.total_ratings_needed
    assert_equal 0, component.missing_ratings
    assert_in_delta(0.0, component.missing_rate)
  end

  def test_plural_queries_without_results
    stats = [
      { query_id: 1, ratings_count: 0 },
      { query_id: 2, ratings_count: 0 },
      { query_id: 3, ratings_count: 5 }
    ]
    params = default_params.merge(queries_count: 3, rating_stats: stats)
    render_inline(FrogReportComponent.new(**params))

    assert_text '2 return'
    assert_text 'zero'
  end
end

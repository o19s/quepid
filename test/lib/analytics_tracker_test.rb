# frozen_string_literal: true

require 'test_helper'

class AnalyticsTrackerTest < ActiveSupport::TestCase
  setup do
    @previous_ahoy = Thread.current[:ahoy]
    @delivery = Class.new do
      attr_reader :events

      def initialize
        @events = []
      end

      def track name, properties
        @events << [ name, properties ]
      end
    end.new
    Thread.current[:ahoy] = @delivery
    @case = Struct.new(:id, :case_name, :snapshots, :queries, keyword_init: true).new(id: 42, case_name: 'Case name', snapshots: Array.new(5), queries: Array.new(6))
    @user = Struct.new(:email, :cases, :owned_scorers, keyword_init: true).new(email: 'actor@example.test', cases: Array.new(3), owned_scorers: Array.new(4))
    @query = Struct.new(:query_text, :case, keyword_init: true).new(query_text: 'Query text', case: @case)
    @rating = Struct.new(:query, :rating, keyword_init: true).new(query: @query, rating: 2.5)
    @try = Struct.new(:case, :try_number, keyword_init: true).new(case: @case, try_number: 7)
    @snapshot = Struct.new(:case, :name, keyword_init: true).new(case: @case, name: 'Snapshot name')
    @scorer = Struct.new(:name, keyword_init: true).new(name: 'Scorer name')
    @team = Class.new do
      attr_accessor :name, :members
    end.new
    @team.name = 'Team name'
    @team.members = Array.new(2)
    @member = Struct.new(:email, keyword_init: true).new(email: 'member@example.test')
    @book = Struct.new(:id, :name, keyword_init: true).new(id: 84, name: 'Book name')
  end

  teardown do
    Thread.current[:ahoy] = @previous_ahoy
  end

  # Method, arguments (symbols refer to setup records), stored name, exact payload.
  [
    [ :track_query_doc_pairs_bulk_updated_event, [ :user, :book, true ], 'books:populated_empty_book',
      { category: 'Books', action: 'Populated empty book', label: 'Book name', value: 84 } ],
    [ :track_query_doc_pairs_bulk_updated_event, [ :user, :book, false ], 'books:refreshed_a_book',
      { category: 'Books', action: 'Refreshed a book', label: 'Book name', value: 84 } ],
    [ :track_case_created_event, [ :user, :case, true ], 'cases:created_first_case',
      { category: 'Cases', action: 'Created First Case', label: 'actor@example.test', value: 1 } ],
    [ :track_case_created_event, [ :user, :case, false ], 'cases:created_a_case',
      { category: 'Cases', action: 'Created a Case', label: 'Case name', value: 3 } ],
    [ :track_case_updated_event, [ :user, :case ], 'cases:updated_a_case',
      { category: 'Cases', action: 'Updated a Case', label: 'Case name', value: nil } ],
    [ :track_case_archived_event, [ :user, :case ], 'cases:archived_a_case',
      { category: 'Cases', action: 'Archived a Case', label: 'Case name', value: nil } ],
    [ :track_case_deleted_event, [ :user, :case ], 'cases:deleted_a_case',
      { category: 'Cases', action: 'Deleted a Case', label: 'Case name', value: nil } ],
    [ :track_case_shared_event, [ :user, :case, :team ], 'cases:shared_a_case',
      { category: 'Cases', action: 'Shared a Case', label: 'Case name', value: nil } ],
    [ :track_user_swapped_protocol, [ :user, :case, 'https' ], 'cases:swapped_to_protocol',
      { category: 'Cases', action: 'Swapped to Protocol', label: 'Case name', value: 'https', case_id: 42 } ],
    [ :track_query_created_event, [ :user, :query ], 'queries:created_a_query',
      { category: 'Queries', action: 'Created a Query', label: 'Query text', value: 6 } ],
    [ :track_query_deleted_event, [ :user, :query ], 'queries:deleted_a_query',
      { category: 'Queries', action: 'Deleted a Query', label: 'Query text', value: nil } ],
    [ :track_query_moved_event, [ :user, :query, :case ], 'queries:moved_a_query',
      { category: 'Queries', action: 'Moved a Query', label: 'Query text', value: nil } ],
    [ :track_query_notes_updated_event, [ :user, :query ], 'queries:updated_query_notes',
      { category: 'Queries', action: 'Updated Query Notes', label: 'Query text', value: nil } ],
    [ :track_query_options_updated_event, [ :user, :query ], 'queries:updated_query_options',
      { category: 'Queries', action: 'Updated Query Options', label: 'Query text', value: nil } ],
    [ :track_rating_created_event, [ :user, :rating ], 'ratings:rated_a_query',
      { category: 'Ratings', action: 'Rated a Query', label: 'Query text', value: 2.5 } ],
    [ :track_rating_deleted_event, [ :user, :rating ], 'ratings:reset_a_query_rating',
      { category: 'Ratings', action: 'Reset a Query Rating', label: 'Query text', value: nil } ],
    [ :track_rating_bulk_updated_event, [ :user, :query ], 'ratings:bulk_updated_query_ratings',
      { category: 'Ratings', action: 'Bulk Updated Query Ratings', label: 'Query text', value: nil } ],
    [ :track_rating_bulk_deleted_event, [ :user, :query ], 'ratings:bulk_deleted_query_ratings',
      { category: 'Ratings', action: 'Bulk Deleted Query Ratings', label: 'Query text', value: nil } ],
    [ :track_scorer_created_event, [ :user, :scorer ], 'scorers:created_a_scorer',
      { category: 'Scorers', action: 'Created a Scorer', label: 'Scorer name', value: 4 } ],
    [ :track_scorer_updated_event, [ :user, :scorer ], 'scorers:updated_a_scorer',
      { category: 'Scorers', action: 'Updated a Scorer', label: 'Scorer name', value: nil } ],
    [ :track_scorer_deleted_event, [ :user, :scorer ], 'scorers:deleted_a_scorer',
      { category: 'Scorers', action: 'Deleted a Scorer', label: 'Scorer name', value: nil } ],
    [ :track_scorer_shared_event, [ :user, :scorer, :team ], 'scorers:shared_a_scorer',
      { category: 'Scorers', action: 'Shared a Scorer', label: 'Scorer name', value: nil } ],
    [ :track_snapshot_created_event, [ :user, :snapshot ], 'snapshots:created_a_snapshot',
      { category: 'Snapshots', action: 'Created a Snapshot', label: 'Snapshot name', value: 5 } ],
    [ :track_snapshot_deleted_event, [ :user, :snapshot ], 'snapshots:deleted_a_snapshot',
      { category: 'Snapshots', action: 'Deleted a Snapshot', label: 'Snapshot name', value: nil } ],
    [ :track_team_created_event, [ :user, :team ], 'teams:created_an_team',
      { category: 'Teams', action: 'Created an Team', label: 'Team name', value: 1 } ],
    [ :track_team_updated_event, [ :user, :team ], 'teams:updated_an_team',
      { category: 'Teams', action: 'Updated an Team', label: 'Team name', value: nil } ],
    [ :track_team_deleted_event, [ :user, :team ], 'teams:deleted_an_team',
      { category: 'Teams', action: 'Deleted an Team', label: 'Team name', value: nil } ],
    [ :track_member_added_to_team_event, [ :user, :team, :member ], 'teams:added_member_to_an_team',
      { category: 'Teams', action: 'Added Member to an Team', label: 'Team name', value: 2 } ],
    [ :track_member_removed_from_team_event, [ :user, :team, :member ], 'teams:removed_member_from_an_team',
      { category: 'Teams', action: 'Removed Member from an Team', label: 'Team name', value: 2 } ],
    [ :track_try_saved_event, [ :user, :try ], 'case_tries:saved_a_case_try',
      { category: 'Case Tries', action: 'Saved a Case Try', label: 'Case name', value: 7 } ],
    [ :track_signup_event, [ :user ], 'users:signed_up',
      { category: 'Users', action: 'Signed Up', label: 'actor@example.test', value: nil } ],
    [ :track_user_updated_profile_event, [ :user ], 'users:updated_profile',
      { category: 'Users', action: 'Updated Profile', label: 'actor@example.test', value: nil } ],
    [ :track_user_updated_password_event, [ :user ], 'users:updated_password',
      { category: 'Users', action: 'Updated Password', label: 'actor@example.test', value: nil } ],
    [ :track_user_updated_by_admin_event, [ :user ], 'users:updated_by_admin',
      { category: 'Users', action: 'Updated by Admin', label: 'actor@example.test', value: nil } ]
  ].each do |method, arguments, event_name, properties|
    test "#{method} preserves #{event_name}" do
      records = arguments.map { |argument| argument.is_a?(Symbol) ? instance_variable_get("@#{argument}") : argument }
      Analytics::Tracker.public_send(method, *records)

      assert_equal [ [ event_name, properties ] ], @delivery.events
    end
  end

  test 'book sharing preserves its event payload' do
    Analytics::Tracker.track_book_shared_event @user, @book, @team

    assert_equal [
      [ 'books:shared_a_book', { category: 'Books', action: 'Shared a Book', label: 'Book name', value: nil } ]
    ], @delivery.events
  end

  test 'search endpoint sharing preserves its event payload' do
    endpoint = Struct.new(:fullname, keyword_init: true).new(fullname: 'Endpoint name')
    Analytics::Tracker.track_search_endpoint_shared_event @user, endpoint, @team

    assert_equal [
      [ 'search_endpoints:shared_a_search_endpoint', { category: 'Search Endpoints', action: 'Shared a Search Endpoint', label: 'Endpoint name', value: nil } ]
    ], @delivery.events
  end
end

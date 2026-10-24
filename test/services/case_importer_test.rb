# frozen_string_literal: true

require 'test_helper'

class CaseImporterTest < ActiveSupport::TestCase
  cover 'CaseImporter*'

  let(:user)            { users(:random) }
  let(:acase)           { cases(:queries_case) }
  let(:new_case)        { Case.new }

  let(:data) do
    {
      case_name: 'test case',
      scorer:    { name: acase.scorer.name },
      try:       {
        escape_query:    true,
        search_endpoint: {
          name:          'a brand new endpoint',
          endpoint_url:  'http://a-brand-new-endpoint.example.com/select',
          search_engine: 'solr',
          api_method:    'GET',
        },
      },
      queries:   [
        {
          query_text:       'First Query',
          information_need: 'I am the first query',
          ratings:          [],
        },
        {
          query_text:       'Second Query',
          information_need: 'I am the second query',
          ratings:          [
            { doc_id: 'doca', rating: 3.0, user_email: user.email },
            { doc_id: 'docb', rating: 1.0 }
          ],
        }
      ],
    }
  end

  describe '#validate' do
    test 'does not add errors when the scorer exists and rating users already exist' do
      importer = CaseImporter.new new_case, user, data

      importer.validate

      assert_empty new_case.errors
    end

    test 'adds an error when the scorer does not exist' do
      data[:scorer] = { name: 'a scorer that does not exist' }

      importer = CaseImporter.new new_case, user, data

      importer.validate

      assert_includes new_case.errors[:scorer],
                      "Scorer with name 'a scorer that does not exist' needs to be migrated over first."
    end

    test 'adds an error instead of raising when the scorer is missing' do
      data.delete(:scorer)

      importer = CaseImporter.new new_case, user, data

      importer.validate

      assert_predicate new_case.errors[:scorer], :present?
    end

    test 'adds an error when a rating user email does not exist and force_create_users is false' do
      data[:queries].last[:ratings] << { doc_id: 'docc', rating: 2.0, user_email: 'fakeuser@fake.com' }

      importer = CaseImporter.new new_case, user, data

      importer.validate

      assert_includes new_case.errors[:base], "User with email 'fakeuser@fake.com' needs to be migrated over first."
    end

    test 'creates a missing user instead of erroring when force_create_users is true' do
      data[:queries].last[:ratings] << { doc_id: 'docc', rating: 2.0, user_email: 'newuser@fake.com' }

      importer = CaseImporter.new new_case, user, data, force_create_users: true

      assert_difference 'User.count', 1 do
        importer.validate
      end

      assert_empty new_case.errors
      assert User.exists?(email: 'newuser@fake.com')
    end
  end

  describe 'construction' do
    test 'defaults the logger, progress and user creation options' do
      importer = CaseImporter.new new_case, user, data

      assert_same Rails.logger, importer.logger
      assert_same Rails.logger, importer.options[:logger]
      assert_not importer.options[:show_progress]
      assert_not importer.options[:force_create_users]
    end

    test 'merges symbolized overrides over the defaults' do
      custom_logger = Logger.new(nil)
      importer = CaseImporter.new new_case, user, data, 'logger' => custom_logger, 'force_create_users' => true

      assert_same custom_logger, importer.logger
      assert importer.options[:force_create_users]
      assert_not importer.options[:show_progress]
    end
  end

  describe 'validation details' do
    test 'a blank scorer name says the scorer is required' do
      data[:scorer] = { name: '' }
      CaseImporter.new(new_case, user, data).validate

      assert_equal [ 'is required. Import a file exported from a Quepid case.' ], new_case.errors[:scorer]
    end

    test 'a missing scorer does not also report it as unmigrated' do
      data.delete(:scorer)
      CaseImporter.new(new_case, user, data).validate

      assert_equal 1, new_case.errors[:scorer].size
    end

    test 'reports each unknown rating user once, ignoring blank emails' do
      data[:queries].last[:ratings] = [
        { doc_id: 'a', rating: 1.0, user_email: 'ghost@fake.com' },
        { doc_id: 'b', rating: 1.0, user_email: 'ghost@fake.com' },
        { doc_id: 'c', rating: 1.0, user_email: '' },
        { doc_id: 'd', rating: 1.0 }
      ]
      CaseImporter.new(new_case, user, data).validate

      assert_equal [ "User with email 'ghost@fake.com' needs to be migrated over first." ], new_case.errors[:base]
    end

    test 'queries without ratings or without any queries are valid' do
      data[:queries] << { query_text: 'No ratings key' }
      CaseImporter.new(new_case, user, data).validate
      assert_empty new_case.errors

      other_case = Case.new
      CaseImporter.new(other_case, user, data.except(:queries)).validate
      assert_empty other_case.errors
    end

    test 'force-created users are invited by the importer without sending an invitation' do
      data[:queries].last[:ratings] << { doc_id: 'docc', rating: 2.0, user_email: 'invitee@fake.com' }
      CaseImporter.new(new_case, user, data, force_create_users: true).validate

      invitee = User.find_by!(email: 'invitee@fake.com')
      assert_equal user, invitee.invited_by
      assert_nil invitee.invitation_sent_at
    end
  end

  describe '#import' do
    test 'copies the case settings from the data' do
      data.merge!(options: { 'show_only_rated' => true }, public: true, archived: true)
      assert CaseImporter.new(new_case, user, data).import

      new_case.reload
      assert_equal({ 'show_only_rated' => true }, new_case.options)
      assert new_case.public
      assert new_case.archived
    end

    test 'copies false case settings rather than leaving defaults' do
      data.merge!(public: false, archived: false)
      assert CaseImporter.new(new_case, user, data).import

      assert_not new_case.reload.public
      assert_not new_case.archived
    end

    test 'puts the first try settings on try number one without touching its id' do
      data[:try].merge!(id: 999_999, try_number: 42, escape_query: false, name: 'Imported try', number_of_rows: 25)
      assert CaseImporter.new(new_case, user, data).import

      first_try = new_case.tries.reload.first
      assert_equal 1, first_try.try_number
      assert_not_equal 999_999, first_try.id
      assert_equal 'Imported try', first_try.name
      assert_not first_try.escape_query
      assert_equal 25, first_try.number_of_rows
      assert_equal SearchEndpoint.find_by!(name: 'a brand new endpoint').id, first_try.search_endpoint_id
    end

    test 'imports a case without queries and queries without a ratings key' do
      data[:queries] = [ { query_text: 'Only text' } ]
      assert CaseImporter.new(new_case, user, data).import
      assert_equal [ 'Only text' ], new_case.queries.reload.map(&:query_text)
      assert_equal 0, new_case.ratings.count

      other_case = Case.new
      assert CaseImporter.new(other_case, user, data.except(:queries)).import
      assert_equal 0, other_case.queries.count
    end

    test 'a query with nil ratings does not stop later queries from importing their ratings' do
      data[:queries].unshift({ query_text: 'Nil ratings', ratings: nil })
      assert CaseImporter.new(new_case, user, data).import

      assert_equal 3, new_case.queries.count
      assert_equal 2, new_case.ratings.count
    end

    test 'ratings without a user email are imported without a user' do
      CaseImporter.new(new_case, user, data).import

      anonymous = new_case.ratings.find_by!(doc_id: 'docb')
      assert_nil anonymous.user
    end

    test 'an invalid search endpoint reports its errors on the case and rolls everything back' do
      data[:try][:search_endpoint][:endpoint_url] = ''
      importer = CaseImporter.new new_case, user, data

      assert_no_difference [ 'Case.count', 'Query.count', 'SearchEndpoint.count' ] do
        assert_not importer.import
      end

      assert_includes new_case.errors[:endpoint_url], "can't be blank"
    end

    test 'creates the case with the current user as owner' do
      importer = CaseImporter.new new_case, user, data

      assert importer.import
      assert_predicate new_case, :persisted?
      assert_equal 'test case', new_case.case_name
      assert_equal user, new_case.owner
      assert_equal acase.scorer, new_case.scorer
    end

    test 'builds queries and ratings' do
      imported_data = data.merge(queries: data[:queries].reverse)
      importer = CaseImporter.new new_case, user, imported_data
      importer.import

      assert_equal 2, new_case.queries.count
      assert_equal 2, new_case.ratings.count
      assert_equal [ 'Second Query', 'First Query' ], new_case.queries.reload.map(&:query_text)

      second_query = new_case.queries.find_by(query_text: 'Second Query')
      assert_equal user, second_query.ratings.find_by(doc_id: 'doca').user
    end

    test 'attaches a new search endpoint matching the given attributes' do
      importer = CaseImporter.new new_case, user, data

      assert_difference 'SearchEndpoint.count', 1 do
        importer.import
      end

      assert_equal 'http://a-brand-new-endpoint.example.com/select', new_case.tries.first.search_endpoint.endpoint_url
    end

    test 'reuses an existing matching search endpoint instead of duplicating it' do
      existing = SearchEndpoint.create!(
        name:          'Existing endpoint',
        endpoint_url:  'http://a-brand-new-endpoint.example.com/select',
        search_engine: 'solr',
        api_method:    'GET',
        owner:         user
      )

      importer = CaseImporter.new new_case, user, data

      assert_no_difference 'SearchEndpoint.count' do
        importer.import
      end

      assert_equal existing, new_case.tries.first.search_endpoint
    end

    test 'creates curator variables on the first try' do
      data[:try][:curator_variables] = [ { name: 'anInt', value: 1 } ]

      importer = CaseImporter.new new_case, user, data
      importer.import

      assert_equal 1, new_case.tries.first.curator_variables.count
      assert_equal 'anInt', new_case.tries.first.curator_variables.first.name
    end

    test 'rolls back and returns false when the case fails to save' do
      data[:case_name] = nil

      importer = CaseImporter.new new_case, user, data

      assert_not importer.import
      assert_not new_case.persisted?
      assert_empty new_case.queries
    end
  end
end

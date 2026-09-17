# frozen_string_literal: true

require 'test_helper'

class CaseImporterTest < ActiveSupport::TestCase
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

  describe '#import' do
    test 'creates the case with the current user as owner' do
      importer = CaseImporter.new new_case, user, data

      assert importer.import
      assert_predicate new_case, :persisted?
      assert_equal 'test case', new_case.case_name
      assert_equal user, new_case.owner
      assert_equal acase.scorer, new_case.scorer
    end

    test 'builds queries and ratings' do
      importer = CaseImporter.new new_case, user, data
      importer.import

      assert_equal 2, new_case.queries.count
      assert_equal 2, new_case.ratings.count

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

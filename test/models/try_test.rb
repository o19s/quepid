# frozen_string_literal: true

require 'test_helper'

class TryTest < ActiveSupport::TestCase
  describe 'Curator Vars' do
    test 'adds curator vars to try' do
      try = tries(:try_without_curator_vars)

      vars = {
        one: 1,
        two: 2,
      }

      assert_difference 'try.curator_variables.count', 2 do
        try.add_curator_vars vars
      end
    end

    test 'retrieves curator vars as a map of key (name) / value' do
      try = tries(:try_with_curator_vars)
      vars = try.curator_vars_map

      expected_vars = {
        one: 1,
        two: 2,
      }

      assert_instance_of  Hash,           vars
      assert_equal        expected_vars,  vars
    end

    it 'gets deleted and deletes the associated curator vars without an error' do
      try = tries(:try_with_curator_vars)
      assert try.destroy
    end
  end

  describe 'Args Parser' do
    describe 'for Solr params' do
      test 'parses params and returns the appropriate object' do
        sa = tries(:one).args
        assert_equal [ '#$query##' ], sa['q']
      end

      test 'replaces curator vars' do
        try   = tries(:try_with_curator_vars)
        args  = try.args

        assert_equal args['q'],   [ '#$query##' ]
        assert_equal args['qf'],  [ 'text^1 catch_line^2' ]
      end
    end

    describe 'for ES params' do
      test 'parses params and returns the appropriate object' do
        try   = tries(:es_try)
        args  = try.args

        expected_vars = {
          'query' => {
            'match' => {
              'text' => "#\$query##",
            },
          },
        }

        assert_equal args, expected_vars
      end

      test 'replaces curator vars' do
        try   = tries(:es_try_with_curator_vars)
        args  = try.args

        expected_vars = {
          'query' => {
            'multi_match' => {
              'fields'      => 'title, overview',
              'query'       => "#\$query##",
              'tie_breaker' => '1',
            },
          },
        }

        assert_equal args, expected_vars
      end
    end

    describe 'Search API' do
      test 'spots that args are JSON formatted and returns the appropriate object' do
        try = tries(:es_try)
        try.search_endpoint.search_engine = 'searchapi'
        args = try.args

        expected_vars = {
          'query' => {
            'match' => {
              'text' => "#\$query##",
            },
          },
        }

        assert_equal args, expected_vars
      end

      test 'spots that args are query param formatted and returns the appropriate object' do
        try = tries(:one)
        try.search_endpoint.search_engine = 'searchapi'

        args = try.args

        expected_vars = {
          'q' => [ "\#$query##" ],
        }

        assert_equal args, expected_vars
      end

      test 'handles when the search_engine is not defined' do
        try = tries(:one)
        try.search_endpoint.search_engine = nil

        args = try.args

        expected_vars = nil

        assert_equal args, expected_vars
      end

      test 'handles unknown search_engine' do
        try = tries(:one)
        try.search_endpoint.search_engine = 'bob'

        args = try.args

        expected_vars = nil

        assert_equal args, expected_vars
      end
    end
  end

  describe 'Getting the id field from field_spec' do
    test 'parses params and returns the appropriate object' do
      try = tries(:one)
      assert_equal 'id', try.id_from_field_spec

      try.field_spec = 'id title'
      assert_equal 'id', try.id_from_field_spec

      try.field_spec = '_id title'
      assert_equal '_id', try.id_from_field_spec

      try.field_spec = 'id:id title'
      assert_equal 'id', try.id_from_field_spec

      try.field_spec = 'title:title name id:id'
      assert_equal 'id', try.id_from_field_spec

      try.field_spec = 'id:id, title:title, overview, thumb:poster_path'
      assert_equal 'id', try.id_from_field_spec
    end
  end

  describe 'Getting the index name from the search_url' do
    test 'parses search_url and returns index name' do
      try = tries(:one)
      assert_equal 'tmdb', try.index_name_from_search_url

      try = tries(:es_try)
      assert_equal 'tmdb', try.index_name_from_search_url
    end
  end

  describe 'tracking history of tries' do
    test 'try two follows try one, and three follows two' do
      try_one = tries(:for_case_with_score_try_1)
      try_two = tries(:for_case_with_score_try_2)
      try_three = tries(:for_case_with_score_try_3)

      try_two.parent = try_one
      try_two.save!

      try_three.parent_id = try_two.id
      try_three.save!

      assert_includes try_one.children, try_two
      assert_includes try_two.children, try_three

      try_two.destroy!

      # validate that three gets adopted by one
      assert_includes try_one.children, try_three
    end
  end

  describe 'handling options' do
    test 'try options logic works when no options defined' do
      try = Try.new
      assert try.options.empty?
    end

    test 'try options logic works when options is not actually json' do
      try = tries(:one)
      try.search_endpoint.options = 'not a json string'
      assert try.options.empty?
      try.search_endpoint.options = nil
      try.case.options = 'not a json string'
      assert try.options.empty?
    end

    test 'try handles missing options' do
      options_hash = {
        a: 1,
      }
      try = tries(:one)
      try.case.options = '{"a":1}'
      try.case.save!

      assert_equal options_hash.to_json, try.options.to_json

      try.case.options = nil
      try.case.save!
      try.search_endpoint.options = '{"a":1}'
      try.search_endpoint.save!

      assert_equal options_hash.to_json, try.options.to_json
    end

    test 'try can merge search engine options OVER case options' do
      try = tries(:one)
      case_options = {
        a: 1,
        b: 'bee',
      }
      search_endpoint_options = {
        a: 10,
        c: 'sea',
      }
      expected_options = {
        a: 10,
        b: 'bee',
        c: 'sea',
      }

      try.case.options = case_options
      try.search_endpoint.options = search_endpoint_options

      assert_equal expected_options.to_json, try.options.to_json
    end
  end
end

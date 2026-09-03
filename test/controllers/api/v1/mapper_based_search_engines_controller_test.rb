# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class MapperBasedSearchEnginesControllerTest < ActionController::TestCase
      let(:user) { users(:doug) }

      before do
        @controller = Api::V1::MapperBasedSearchEnginesController.new

        login_user user
      end

      describe 'index' do
        test 'returns the Vespa mapper based search engine' do
          get :index

          assert_response :ok

          engines = response.parsed_body['mapper_based_search_engines']
          vespa = engines.find { |engine| 'vespa' == engine['id'] }

          assert vespa
          assert_equal 'Vespa', vespa['name']
          assert_equal 'searchapi', vespa['searchEngine']
          assert_equal 'GET', vespa['apiMethod']
          assert_predicate vespa['mapperCode'], :present?
        end
      end
    end
  end
end

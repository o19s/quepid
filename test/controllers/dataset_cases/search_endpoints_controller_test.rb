# frozen_string_literal: true

require 'test_helper'

module DatasetCases
  class SearchEndpointsControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    setup do
      login_user_for_integration_test user
    end

    def link_case dataset_key, name:
      kase = Case.create!(case_name: name, owner: user)
      CaseToDataset.create!(dataset: Dataset.for(user, dataset_key), case: kase, status: 'done')
      kase
    end

    def make_endpoint name = 'Chorus'
      SearchEndpoint.create!(owner: user, name: name, search_engine: :solr, api_method: 'JSONP', endpoint_url: "http://example.com/#{name}/select")
    end

    test 'update points one case at the chosen search endpoint and leaves the others alone' do
      chosen = link_case('imdb', name: 'Chosen')
      other = link_case('imdb', name: 'Other')
      endpoint = make_endpoint

      patch dataset_case_search_endpoint_url(CaseToDataset.find_by(case: chosen)), params: { search_endpoint_id: endpoint.id }

      assert_redirected_to dataset_cases_url
      assert_match(/Chosen now searches Chorus/, flash[:notice])
      assert_equal endpoint, chosen.tries.first.reload.search_endpoint
      assert_nil other.tries.first.reload.search_endpoint
      get dataset_cases_url

      assert_select 'td a[href=?]', search_endpoint_path(endpoint), text: 'Chorus', count: 1
      assert_select 'button', text: 'Initiate indexing', count: 1
    end

    test 'update changes the latest try only, and does not index or create anything' do
      kase = link_case('imdb', name: 'Two tries')
      kase.tries.create!(try_number: 2)
      endpoint = make_endpoint

      assert_no_difference [ 'Case.count', 'Scorer.count', 'Query.count', 'Try.count' ] do
        patch dataset_case_search_endpoint_url(CaseToDataset.find_by(case: kase)), params: { search_endpoint_id: endpoint.id }
      end

      assert_equal endpoint, kase.tries.reload.first.search_endpoint
      assert_equal [ nil ], kase.tries.reload.drop(1).map(&:search_endpoint)
    end

    test 'update refuses an endpoint the user cannot use, an archived one, or none' do
      kase = link_case('imdb', name: 'Picky')
      link = CaseToDataset.find_by(case: kase)
      theirs = make_endpoint('Theirs').tap { |endpoint| endpoint.update!(owner: users(:doug)) }
      archived = make_endpoint('Old').tap { |endpoint| endpoint.update!(archived: true) }

      [ theirs.id, archived.id, 0, nil ].each do |id|
        patch dataset_case_search_endpoint_url(link), params: { search_endpoint_id: id }

        assert_redirected_to dataset_cases_url
        assert_match(/Pick a search endpoint/, flash[:alert])
      end

      assert_nil kase.tries.first.reload.search_endpoint
    end

    test 'update refuses a case that is still loading' do
      kase = link_case('imdb', name: 'Busy')
      link = CaseToDataset.find_by(case: kase)
      link.update!(status: 'loading')

      patch dataset_case_search_endpoint_url(link), params: { search_endpoint_id: make_endpoint.id }

      assert_match(/still loading/, flash[:alert])
      assert_nil kase.tries.first.reload.search_endpoint
    end

    test 'update does not touch another users case, or a case that is no longer the users own' do
      other = Case.create!(case_name: 'Theirs', owner: users(:doug))
      their_link = CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: other, status: 'done')
      endpoint = make_endpoint

      patch dataset_case_search_endpoint_url(their_link), params: { search_endpoint_id: endpoint.id }

      assert_response :not_found
      assert_nil other.tries.first.reload.search_endpoint

      taken = link_case('imdb', name: 'Taken over')
      taken.update!(owner: users(:doug))
      patch dataset_case_search_endpoint_url(CaseToDataset.find_by(case: taken)), params: { search_endpoint_id: endpoint.id }

      assert_match(/belongs to someone else/, flash[:alert])
      assert_nil taken.tries.first.reload.search_endpoint
    end
  end
end

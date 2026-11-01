# frozen_string_literal: true

require 'test_helper'

# The sidebar lights an icon by whether the page address contains a word, and the Datasets pages have "case" and
# "scorers" in theirs: only the Datasets icon may be lit on them.
class DatasetSidebarTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  setup do
    login_user_for_integration_test user
  end

  def lit_icons
    css_select('.sidebar a.nav-link.active').pluck('aria-label')
  end

  test 'only the Datasets icon is lit on each page of the section' do
    link = CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: Case.create!(case_name: 'A case', owner: user), status: 'done')
    endpoint = SearchEndpoint.create!(owner: user, name: 'ES', search_engine: :es, api_method: 'POST', endpoint_url: 'http://es.example.com/m/_search')

    [ datasets_url, dataset_cases_url, dataset_scorers_url, dataset_case_index_url(link, search_endpoint_id: endpoint.id) ].each do |url|
      get url

      assert_response :success
      assert_equal [ 'Datasets' ], lit_icons, url
    end
  end

  test 'the menu that stands in for the sidebar on small screens has Datasets too' do
    get root_url

    assert_select 'ul.navbar-nav li.nav-item.d-lg-none a.nav-link[href=?]', datasets_path, text: 'Datasets'
  end

  test 'the Cases and Scorers icons are still lit on their own pages' do
    get cases_url

    assert_equal [ 'Relevancy Cases' ], lit_icons

    get scorers_url

    assert_equal [ 'Scorers' ], lit_icons
  end
end

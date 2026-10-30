# frozen_string_literal: true

require 'test_helper'

class DatasetsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }

  setup do
    login_user_for_integration_test user
  end

  test 'index lists the loadable datasets first, then the coming soon ones' do
    get datasets_url

    assert_response :success
    names = css_select('tbody tr td:first-child a').map(&:text)

    assert_equal [ 'Haystack Rating Party', 'IMDb Non-Commercial Datasets' ], names.first(2)
    assert_equal [ 'ESCI', 'WANDS', 'Home Depot Product Search Relevance' ], names.last(3)
    assert_select 'button[disabled]', text: 'Coming soon', count: 3
  end

  test 'index describes each dataset by its queries, documents, judgements and labels, and nothing else' do
    get datasets_url

    %w[Queries Documents Judgements Labels Cases].each { |heading| assert_select 'th', text: heading }
    assert_select 'th', text: /\AScorers/
    assert_select 'th', text: 'In Quepid', count: 0
    assert_select 'td', text: '137 queries'
    assert_select 'td', text: '0 Poor, 1 Fair, 2 Good, 3 Perfect'
  end

  test 'index has the two tabs and one load to case button per loadable dataset' do
    Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'ul.nav-tabs a.nav-link.active', text: 'Datasets'
    assert_select 'ul.nav-tabs a[href=?]', dataset_cases_path, text: 'Dataset Cases'
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), text: 'Load to case', count: 1
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'imdb'), text: 'Load to case', count: 1
    assert_select 'a, button', text: /Index in search backend/, count: 0
  end

  test 'index counts the cases made from each dataset, without archived ones' do
    get datasets_url

    assert_equal(%w[0 0 — — —], css_select('tbody tr td:nth-child(8)').map { |cell| cell.text.strip })

    dataset = Dataset.for(user, 'imdb')
    [ Case.create!(case_name: 'One', owner: user), Case.create!(case_name: 'Two', owner: user),
      Case.create!(case_name: 'Archived', owner: user, archived: true) ].each do |kase|
      CaseToDataset.create!(dataset: dataset, case: kase)
    end
    get datasets_url

    assert_equal(%w[0 2 — — —], css_select('tbody tr td:nth-child(8)').map { |cell| cell.text.strip })
  end

  test 'index counts only the current users cases' do
    CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: Case.create!(case_name: 'Theirs', owner: users(:doug)))
    get datasets_url

    assert_equal(%w[0 0 — — —], css_select('tbody tr td:nth-child(8)').map { |cell| cell.text.strip })
  end

  test 'index disables load to case for a dataset with labels until it has a scorer' do
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 1
    assert_select 'span[title*=?]', 'Create a scorer first', count: 1
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), count: 0
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'imdb'), text: 'Load to case', count: 1, message: 'IMDb has no labels, so no scorer to wait for'

    Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 0
    assert_select 'a[href=?]', dataset_cases_path(dataset: 'haystack'), text: 'Load to case', count: 1
  end

  test 'a scorer another user made for the dataset does not enable load to case' do
    Scorer.create!(name: 'Haystack Rating Party Theirs', owner: users(:doug), scale: [ 0, 1, 2, 3 ])
    get datasets_url

    assert_select 'button[disabled]', text: 'Load to case', count: 1
  end

  test 'the action buttons sit at the top of their cell, whatever the height of the row' do
    get datasets_url

    cells = css_select('tbody tr td:last-child')

    assert_equal 5, cells.size
    assert(cells.all? { |cell| cell['class'].split.include?('align-top') })
  end

  test 'the scorers header points to a note about needing a scorer compatible with the dataset labels' do
    get datasets_url

    assert_select 'th a[href="#scorer-note"]', text: '(1)'
    assert_select 'p#scorer-note', text: /needs a scorer compatible with the system of labels the dataset provides/
  end

  test 'index lists the scorers whose names start with the dataset name' do
    get datasets_url

    assert_equal([ '-' ] * 5, css_select('tbody tr td:nth-child(7)').map { |cell| cell.text.strip })

    own = Scorer.create!(name: 'Haystack Rating Party Scorer', owner: user, scale: [ 0, 1, 2, 3 ])
    shared = Scorer.create!(name: 'Haystack Rating Party AP', communal: true, scale: [ 0, 1 ])
    Scorer.create!(name: 'My Haystack Rating Party', owner: user, scale: [ 0, 1 ]) # the name is not a prefix
    Scorer.create!(name: 'Haystack Rating Party Theirs', owner: users(:doug), scale: [ 0, 1 ]) # not visible to this user
    get datasets_url

    haystack_row = css_select('tbody tr').find { |row| row.text.include?('Haystack Rating Party') && 'Haystack Rating Party' == row.at_css('td a').text }
    links = haystack_row.css('td a[href^="/scorers/"]')

    assert_equal [ 'Haystack Rating Party AP', 'Haystack Rating Party Scorer' ], links.map(&:text)
    assert_equal [ edit_scorer_path(shared), edit_scorer_path(own) ], links.pluck('href')
    assert_equal 'Haystack Rating Party AP, Haystack Rating Party Scorer', haystack_row.css('td')[6].text.squish, 'a comma separated list'
  end

  def create_ap
    Scorer.find_or_create_by!(name: 'AP@10') { |scorer| scorer.assign_attributes(scale: [ 0, 1 ], communal: true, code: 'setScore(1);') }
  end

  test 'index offers a create scorer dialog for a dataset with labels, and disables the button for one without' do
    get datasets_url

    assert_select 'button[data-bs-target=?]', '#createScorer-haystack', text: 'Create scorer', count: 1
    assert_select 'button[disabled]', text: 'Create scorer', count: 1
    assert_select 'span[title*=?]', 'no labels to build a scorer from', count: 1
    assert_select '#createScorer-imdb', count: 0
  end

  test 'the create scorer dialog asks which communal scorer to base it on, preselecting AP@10' do
    ap = create_ap
    get datasets_url

    assert_select 'form#create-scorer-form-haystack[action=?]', scorer_dataset_path('haystack') do
      assert_select 'select[name=template_id] option', count: Scorer.communal.count
      assert_select 'select[name=template_id] option[selected][value=?]', ap.id.to_s, text: 'AP@10'
    end
  end

  test 'the create scorer dialog leaves out the templates the user already made a scorer from' do
    ap = create_ap
    post scorer_dataset_url('haystack'), params: { template_id: ap.id }
    get datasets_url

    assert_select 'select[name=template_id] option', text: 'AP@10', count: 0
    assert_select 'select[name=template_id] option', count: Scorer.communal.count - 1
    assert_select 'select[name=template_id] option[selected]', count: 1
  end

  test 'index disables create scorer when the user has a scorer from every template' do
    Scorer.communal.find_each { |template| post scorer_dataset_url('haystack'), params: { template_id: template.id } }
    get datasets_url

    assert_select 'span[title=?]', 'You already have a scorer from every communal scorer', count: 1
    assert_select '#createScorer-haystack', count: 0
  end

  test 'create scorer makes a custom scorer with the dataset labels, named after the dataset and the template' do
    template = create_ap

    assert_difference 'Scorer.count', 1 do
      post scorer_dataset_url('haystack'), params: { template_id: template.id }
    end

    scorer = Scorer.order(:id).last

    assert_redirected_to datasets_url
    assert_match(/Created the scorer Haystack Rating Party AP@10/, flash[:notice])
    assert_equal 'Haystack Rating Party AP@10', scorer.name
    assert_equal user, scorer.owner
    assert_not scorer.communal
    assert_equal [ 0, 1, 2, 3 ], scorer.scale
    assert_equal({ '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' }, scorer.scale_with_labels)
    assert scorer.show_scale_labels
    assert_equal template.code, scorer.code
    assert_equal scorer, Dataset.find_by(owner: user, key: 'haystack').scorer
  end

  test 'create scorer builds on whichever communal scorer was picked, and a dataset can have one per template' do
    ndcg = Scorer.communal.find_by(name: 'nDCG@10') || Scorer.create!(name: 'nDCG@10', communal: true, scale: [ 0, 1, 2, 3 ], code: 'setScore(2);')
    ap = create_ap

    assert_difference 'Scorer.count', 2 do
      post scorer_dataset_url('haystack'), params: { template_id: ndcg.id }
      post scorer_dataset_url('haystack'), params: { template_id: ap.id }
    end

    mine = Scorer.where(owner: user).where('name LIKE ?', 'Haystack Rating Party %').order(:name)

    assert_equal [ 'Haystack Rating Party AP@10', 'Haystack Rating Party nDCG@10' ], mine.map(&:name)
    assert_equal [ ap.code, ndcg.code ], mine.map(&:code)
  end

  test 'create scorer does not make the same scorer twice' do
    ap = create_ap
    post scorer_dataset_url('haystack'), params: { template_id: ap.id }

    assert_no_difference 'Scorer.count' do
      post scorer_dataset_url('haystack'), params: { template_id: ap.id }
    end

    assert_match(/already have the scorer/, flash[:notice])
  end

  test 'create scorer needs a communal scorer as the template' do
    create_ap
    own = Scorer.create!(name: 'Mine', owner: user, scale: [ 0, 1 ])

    assert_no_difference 'Scorer.count' do
      post scorer_dataset_url('haystack')
      post scorer_dataset_url('haystack'), params: { template_id: 0 }
      post scorer_dataset_url('haystack'), params: { template_id: own.id }
    end

    assert_redirected_to datasets_url
    assert_match(/Pick a communal scorer/, flash[:alert])
  end

  test 'create scorer refuses a dataset without labels or one that is not available' do
    ap = create_ap

    assert_no_difference 'Scorer.count' do
      post scorer_dataset_url('imdb'), params: { template_id: ap.id }
      post scorer_dataset_url('esci'), params: { template_id: ap.id }
    end

    assert_redirected_to datasets_url
    assert_match(/no labels/, flash[:alert])
  end

  def make_endpoint owner: user, name: 'Chorus'
    SearchEndpoint.create!(owner: owner, name: name, search_engine: :solr, api_method: 'JSONP', endpoint_url: "http://example.com/#{name}/select")
  end

  test 'endpoint records where the dataset is hosted, and does nothing else' do
    endpoint = make_endpoint

    assert_no_difference [ 'Case.count', 'Scorer.count' ] do
      post endpoint_dataset_url('haystack'), params: { search_endpoint_id: endpoint.id }
    end

    assert_redirected_to dataset_cases_url
    assert_match(/Recorded that Haystack Rating Party is hosted in Chorus/, flash[:notice])
    assert_equal endpoint, Dataset.find_by(owner: user, key: 'haystack').search_endpoint
  end

  test 'endpoint replaces the one recorded before' do
    post endpoint_dataset_url('haystack'), params: { search_endpoint_id: make_endpoint.id }
    other = make_endpoint(name: 'Other')
    post endpoint_dataset_url('haystack'), params: { search_endpoint_id: other.id }

    assert_equal other, Dataset.find_by(owner: user, key: 'haystack').search_endpoint
    assert_equal 1, Dataset.where(owner: user, key: 'haystack').count
  end

  test 'endpoint refuses an endpoint the user cannot use, an archived one, or none' do
    theirs = make_endpoint(owner: users(:doug), name: 'Theirs')
    archived = make_endpoint(name: 'Old')
    archived.update!(archived: true)

    [ theirs.id, archived.id, 0, nil ].each do |id|
      post endpoint_dataset_url('haystack'), params: { search_endpoint_id: id }

      assert_redirected_to dataset_cases_url
      assert_match(/Pick a search endpoint/, flash[:alert])
    end

    assert_nil Dataset.find_by(owner: user, key: 'haystack')
  end

  test 'endpoint refuses a dataset that is not available' do
    post endpoint_dataset_url('esci'), params: { search_endpoint_id: make_endpoint.id }

    assert_redirected_to dataset_cases_url
    assert_match(/not available/, flash[:alert])
  end
end

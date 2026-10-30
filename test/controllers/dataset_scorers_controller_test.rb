# frozen_string_literal: true

require 'test_helper'

class DatasetScorersControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:haystack) { DatasetCatalog.find('haystack') }
  let(:labels) { { '0' => 'Poor', '1' => 'Fair', '2' => 'Good', '3' => 'Perfect' } }

  setup do
    login_user_for_integration_test user
  end

  def dataset_scorer name = 'Haystack Rating Party AP@10', owner: user
    Scorer.create!(name: name, owner: owner, scale: [ 0, 1, 2, 3 ], scale_with_labels: labels)
  end

  test 'index says so when there are no dataset scorers' do
    get dataset_scorers_url

    assert_response :success
    assert_select 'ul.nav-tabs a.nav-link.active', text: 'Dataset Scorers'
    assert_select 'p', text: /no scorers made for a dataset yet/
  end

  test 'index explains, above the list, that a case needs a scorer compatible with the dataset labels' do
    dataset_scorer
    get dataset_scorers_url

    assert_select '.alert-info', text: /A case from a dataset needs a scorer compatible with the system of labels the dataset provides: a scale that covers its rating values, ideally with the same label names\. Use Create scorer to make one that matches\./m
    assert_select '.alert-info a[href=?]', datasets_path, text: 'Create scorer'
    assert_operator response.body.index('alert-info'), :<, response.body.index('<table'), 'the explanation comes before the list'
  end

  test 'the explanation shows when there are no dataset scorers yet too' do
    get dataset_scorers_url

    assert_select '.alert-info', count: 1
  end

  test 'every page of the section has the same three tabs' do
    [ datasets_url, dataset_cases_url, dataset_scorers_url ].each do |url|
      get url

      assert_equal [ 'Datasets', 'Dataset Cases', 'Dataset Scorers' ], css_select('ul.nav-tabs a.nav-link').map(&:text)
    end
  end

  test 'index lists a dataset scorer with its dataset, template and labels' do
    scorer = dataset_scorer
    get dataset_scorers_url

    assert_select 'tbody tr', count: 1
    assert_select 'td a[href=?]', edit_scorer_path(scorer), text: 'Haystack Rating Party AP@10'
    assert_select 'td', text: 'Haystack Rating Party'
    assert_select 'td', text: 'AP@10'
    assert_select 'td', text: '0 Poor, 1 Fair, 2 Good, 3 Perfect'
    assert_select 'td span', text: '-', count: 1
  end

  test 'index leaves out scorers that only look similar' do
    Scorer.create!(name: 'Haystack Rating Party Mine', owner: user, scale: [ 0, 1 ]) # same prefix, other labels
    Scorer.create!(name: 'My Haystack Rating Party AP@10', owner: user, scale: [ 0, 1, 2, 3 ], scale_with_labels: labels) # not a prefix
    Scorer.create!(name: 'Haystack Rating Party Theirs', owner: users(:doug), scale: [ 0, 1, 2, 3 ], scale_with_labels: labels) # not visible
    Scorer.create!(name: 'Shared', communal: true, scale: [ 0, 1, 2, 3 ], scale_with_labels: labels)
    get dataset_scorers_url

    assert_select 'tbody tr', count: 0
  end

  test 'index lists the cases that use each scorer, as a comma separated list of links, without archived ones' do
    scorer = dataset_scorer
    other = dataset_scorer 'Haystack Rating Party CG@10'
    a_case = Case.create!(case_name: 'A case', owner: user, scorer: scorer)
    from_dataset = Case.create!(case_name: 'From the dataset', owner: user, scorer: scorer)
    CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: from_dataset)
    Case.create!(case_name: 'Archived', owner: user, scorer: scorer, archived: true)
    Case.create!(case_name: 'Elsewhere', owner: user, scorer: scorers(:'p@10'))
    get dataset_scorers_url

    row = css_select('tbody tr').find { |tr| tr.text.include?('Haystack Rating Party AP@10') }

    assert_equal 'A case, From the dataset', row.css('td')[4].text.squish
    assert_equal [ case_core_path(a_case), case_core_path(from_dataset) ], row.css('td a[href^="/case/"]').pluck('href')
    assert_equal '-', css_select('tbody tr').find { |tr| tr.text.include?(other.name) }.css('td')[4].text.squish
  end

  test 'index lists a dataset scorer shared with the user through a team, but only their own cases' do
    shared = dataset_scorer 'Haystack Rating Party AP@10', owner: users(:doug)
    shared.update!(communal: true)
    Case.create!(case_name: 'Dougs case', owner: users(:doug), scorer: shared)
    mine = Case.create!(case_name: 'My case', owner: user, scorer: shared)
    get dataset_scorers_url

    assert_select 'tbody tr', count: 1
    assert_select 'td a[href=?]', case_core_path(mine), text: 'My case'
    assert_select 'td a', text: 'Dougs case', count: 0
  end
end

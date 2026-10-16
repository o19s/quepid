# frozen_string_literal: true

require 'test_helper'

class ShareModalsControllerTest < ActionController::TestCase
  let(:doug) { users(:doug) }

  before do
    @controller = ShareModalsController.new
    login_user doug
  end

  def option_texts
    css_select('#share-case-team option').map(&:text)
  end

  test 'renders the case forms with only unshared teams in the picker' do
    kase = cases(:queries_case)
    get :show, params: { record_type: 'case', id: kase.id }

    assert_response :success
    assert_select 'turbo-frame#share-case-frame' do
      assert_select 'form#share-case-form[action=?]', share_case_teams_path do
        assert_select 'input#share-case-id[name=case_id][value=?]', kase.id.to_s
        assert_select 'select#share-case-team[name=team_id][required]:not([disabled])' \
                      '[data-share-case-target=teamSelect][data-action=?]', 'change->share-case#toggleSubmit'
      end
      assert_select 'form#unshare-case-form[action=?]', unshare_case_teams_path do
        assert_select 'input#unshare-case-id[name=case_id][value=?]', kase.id.to_s
        assert_select 'input#unshare-case-team[name=team_id][value=""][data-share-case-target=unshareTeamId]'
      end
    end

    shareable = doug.teams.where.not(id: kase.teams.select(:id)).order(:name)
    assert_equal [ 'Select a team...' ] + shareable.map(&:name), option_texts
    assert_select '#share-case-team option[selected]', 0
  end

  test 'lists the shared teams as selectable unshare rows' do
    team = teams(:valid)
    team.update!(name: '<img src=x onerror=alert(1)>')
    get :show, params: { record_type: 'case', id: cases(:queries_case).id }

    assert_select '#share-case-shared-list[data-share-case-target=sharedList]' do
      assert_select 'button.list-group-item.list-group-item-action.list-group-item-success[type=button]' \
                    '[data-team-id=?][data-share-case-team-id-param=?]', team.id.to_s, team.id.to_s,
                    text: team.name do |rows|
        assert_equal 'click->share-case#selectSharedTeam', rows.first['data-action']
      end
    end
    assert_select 'img', 0
  end

  test 'says when nothing is shared yet' do
    kase = cases(:one)
    kase.teams.clear
    get :show, params: { record_type: 'case', id: kase.id }

    assert_select '#share-case-shared-list p.text-muted', text: 'Not shared with any teams yet.'
    assert_select '#share-case-shared-list [data-team-id]', 0
  end

  test 'distinguishes having no teams from having shared with every team' do
    kase = cases(:one)
    kase.teams = doug.teams.to_a
    get :show, params: { record_type: 'case', id: kase.id }
    assert_equal [ 'No other teams to share with' ], option_texts
    assert_select '#share-case-team[disabled]'

    doug.teams.clear
    get :show, params: { record_type: 'case', id: kase.id }
    assert_equal [ 'You have no teams yet' ], option_texts
    assert_select '#share-case-team[disabled]'
  end

  test 'renders book and search endpoint forms with their own ids, params and paths' do
    get :show, params: { record_type: 'book', id: books(:james_bond_movies).id }
    assert_select 'turbo-frame#share-book-frame'
    assert_select 'form#share-book-form[action=?] input#share-book-id[name=book_id]', share_book_teams_path
    assert_select 'form#unshare-book-form[action=?]', unshare_book_teams_path
    assert_select 'p.h5', text: 'Select a team to share this book with:'
    assert_select '#share-book-shared-list [data-share-book-team-id-param=?]', teams(:shared).id.to_s

    get :show, params: { record_type: 'search_endpoint', id: search_endpoints(:one).id }
    assert_select 'turbo-frame#share-search-endpoint-frame'
    assert_select 'form#share-search-endpoint-form[action=?] input[name=search_endpoint_id]',
                  share_search_endpoint_teams_path
    assert_select 'form#unshare-search-endpoint-form[action=?]', unshare_search_endpoint_teams_path
    assert_select 'p.h5', text: 'Select a team to share this search endpoint with:'
    assert_select '#share-search-endpoint-team[data-action=?]', 'change->share-search-endpoint#toggleSubmit'
  end

  test 'scorer lists only the viewer’s teams unless opened from a team page that has the scorer' do
    scorer = scorers(:shared_scorer)
    outside_team = teams(:case_finder_owned_team)
    scorer.teams << outside_team
    outside_row = [ '#share-scorer-shared-list [data-team-id=?]', outside_team.id.to_s ]

    get :show, params: { record_type: 'scorer', id: scorer.id }
    assert_select 'form#share-scorer-form[action=?]', share_scorers_path
    assert_select 'form#unshare-scorer-form[action=?]', unshare_scorers_path
    assert_select(*outside_row, count: 0)
    assert_select '#share-scorer-shared-list [data-team-id=?]', teams(:shared).id.to_s

    get :show, params: { record_type: 'scorer', id: scorer.id, team_id: teams(:shared).id }
    assert_select(*outside_row)

    # A team the viewer belongs to that lacks the scorer, or one with the scorer
    # the viewer is not in, does not widen the list.
    [ teams(:valid), outside_team ].each do |team|
      get :show, params: { record_type: 'scorer', id: scorer.id, team_id: team.id }
      assert_select(*outside_row, count: 0)
    end
  end

  test 'other record types list every shared team' do
    kase = cases(:queries_case)
    outside_team = teams(:case_finder_owned_team)
    kase.teams << outside_team

    get :show, params: { record_type: 'case', id: kase.id }
    assert_select '#share-case-shared-list [data-team-id=?]', outside_team.id.to_s
  end

  test 'does not render forms for a record the user cannot access' do
    get :show, params: { record_type: 'case', id: cases(:owned_team_case).id }

    assert_response :not_found
    assert_select 'turbo-frame#share-case-frame p.text-danger', text: 'Case not found.'
    assert_select 'form', 0
  end
end

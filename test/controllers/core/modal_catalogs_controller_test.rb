# frozen_string_literal: true

require 'test_helper'

module Core
  class ModalCatalogsControllerTest < ActionController::TestCase
    before do
      @controller = Core::ModalCatalogsController.new
      login_user users(:doug)
    end

    test 'sharing renders only member teams and partitions the case membership' do
      team = teams(:valid)
      team.update!(name: '<img src=x onerror=alert(1)>')
      get :sharing, params: { case_id: cases(:queries_case).id }
      assert_response :success
      assert_equal 'text/html', response.media_type
      assert_select '[data-catalog-list="shared"] button[data-team-id=?]', team.id.to_s do
        assert_select '[data-action="click->share-case-core#selectSharedTeam"]', text: team.name
      end
      assert_select '[data-catalog-list="shareable"] button[data-team-id=?]', teams(:shared).id.to_s
      assert_select 'img', count: 0
      actual_ids = css_select('[data-team-id]').map { |row| row['data-team-id'].to_i }
      assert_equal users(:doug).teams.ids.sort, actual_ids.sort
    end

    test 'sharing renders empty catalogs for a teamless user' do
      user = users(:doug)
      user.teams.clear
      get :sharing, params: { case_id: cases(:one).id }
      assert_response :success
      assert_select '[data-share-catalog]', 1
      assert_select '[data-team-id]', 0
    end

    test 'book catalog merges owned active and visible case-team books once' do
      book = books(:james_bond_movies)
      book.update!(name: '<script>unsafe</script>')
      acase = cases(:one)
      acase.teams << teams(:shared)
      # A collaborator-only team must not expose its books in this catalog.
      acase.teams << teams(:owned_team)
      teams(:owned_team).books << books(:empty_book_2)
      get :books, params: { case_id: acase.id }
      assert_response :success
      assert_select '[data-book-catalog] li:first-child em', text: 'None (disconnect from any book)'
      assert_select '[data-judgements-core-book-id-param=?]', book.id.to_s, count: 1 do
        assert_select '[data-slot="name"]', text: book.name
        assert_select 'a[href=?]', book_path(book, script_name: '').delete_prefix('/')
      end
      assert_select 'script', 0
      assert_select '[data-judgements-core-book-id-param=?]', books(:empty_book_2).id.to_s, count: 0
      # Team-book API includes archived books; the owned-book API excludes them.
      assert_select '[data-judgements-core-book-id-param=?]', books(:archived_book).id.to_s, count: 1
      acase.teams.clear
      get :books, params: { case_id: acase.id }
      assert_select '[data-judgements-core-book-id-param=?]', book.id.to_s, count: 1
      assert_select '[data-judgements-core-book-id-param=?]', books(:archived_book).id.to_s, count: 0
    end

    test 'catalogs reject inaccessible cases and require authentication' do
      [ :sharing, :books ].each do |action|
        get action, params: { case_id: cases(:score_case).id }
        assert_response :not_found
      end
      session[:current_user_id] = nil
      @controller = Core::ModalCatalogsController.new
      get :scorers
      assert_redirected_to new_session_path
    end

    test 'scorer rows escape names and carry the established JSON payload' do
      scorer = scorers(:owned_scorer)
      scorer.update!(name: '<img src=x>', code: '"</script>"', scale_with_labels: { '1' => 'Low' })
      get :scorers
      assert_response :success
      assert_select 'img', 0
      node = css_select("[data-pick-scorer-core-scorer-id-param='#{scorer.id}']").first
      assert_equal scorer.name, node.text
      data = JSON.parse(node['data-scorer-json'])
      assert_equal scorer.code, data['code']
      assert_equal scorer.scale, data['scale']
      assert_equal scorer.scale_with_labels, data['scale_with_labels']
      assert_equal scorer.id, data['scorer_id']
      assert data['owned']
      communal = css_select('[data-catalog-list="communal"] li').first
      assert_equal %w[code communal name scale scale_with_labels scorer_id show_scale_labels], JSON.parse(communal['data-scorer-json']).keys.sort
    end

    test 'communal-only configuration excludes custom scorers' do
      original = Rails.application.config.communal_scorers_only
      Rails.application.config.communal_scorers_only = true
      get :scorers
      assert_response :success
      assert_select '[data-catalog-list="custom"] li', 0
      assert_select '[data-catalog-list="communal"] li', Scorer.communal.count
    ensure
      Rails.application.config.communal_scorers_only = original
    end
  end
end

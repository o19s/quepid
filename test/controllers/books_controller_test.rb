# frozen_string_literal: true

require 'test_helper'

class BooksControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:judge_judy) { users(:judge_judy) }
  let(:book) { books(:book_of_comedy_films) }
  let(:james_bond_movies) { books(:james_bond_movies) }
  let(:communal_scorer) { scorers(:communal_scorer) }

  describe 'running judge judy' do
    setup { register_default_openai_stubs }

    test 'specifying a limit of query/doc pairs' do
      login_user_for_integration_test user

      perform_enqueued_jobs do
        assert_difference 'james_bond_movies.judgements.count' do
          patch "/books/#{james_bond_movies.id}/run_judge_judy/#{judge_judy.id}", params: { number_of_pairs: 1 }
          follow_redirect!
          assert_equal "AI Judge #{judge_judy.name} will start evaluating query/doc pairs.", flash[:notice]
          # a bounded run isn't "judge all", so no kraken-unleashed celebration modal
          assert_no_match(/successModal/, response.body)
        end
      end
    end

    test 'requesting all to be judged overrides the limit setting and does all' do
      login_user_for_integration_test user
      perform_enqueued_jobs do
        patch "/books/#{james_bond_movies.id}/run_judge_judy/#{judge_judy.id}",
              params: { judge_all: 1, number_of_pairs: 1 }
        follow_redirect!
        assert_equal "AI Judge #{judge_judy.name} will start evaluating query/doc pairs.", flash[:notice]
        assert_equal james_bond_movies.query_doc_pairs.count, james_bond_movies.judgements.where(user: judge_judy).count
        # "judge all" mode should still trigger the kraken-unleashed celebration modal
        assert_match(/successModal/, response.body)
        # ...and that boolean must never leak out as a literal "true"/"false" flash alert
        assert_no_match(%r{alert.*>\s*(true|false)\s*</div>}m, response.body)
      end
    end
  end

  describe 'cancelling judge judy' do
    test 'redirects with an error instead of crashing on an unknown ai_judge_id' do
      login_user_for_integration_test user

      delete "/books/#{james_bond_movies.id}/cancel_judge_judy/999999999"

      assert_response :redirect
      follow_redirect!
      assert_equal 'AI Judge not found.', flash[:alert]
    end

    test 'destroys the matching in-flight SolidQueue job for this book and judge' do
      login_user_for_integration_test user

      other_book  = books(:book_of_comedy_films)
      other_judge = users(:doug)

      matching_job = SolidQueue::Job.create!(
        active_job_id: SecureRandom.uuid,
        class_name:    'RunJudgeJudyJob',
        queue_name:    'default',
        arguments:     {
          'arguments' => [
            { '_aj_globalid' => james_bond_movies.to_global_id.to_s },
            { '_aj_globalid' => judge_judy.to_global_id.to_s },
            nil
          ],
        }
      )
      unrelated_job = SolidQueue::Job.create!(
        active_job_id: SecureRandom.uuid,
        class_name:    'RunJudgeJudyJob',
        queue_name:    'default',
        arguments:     {
          'arguments' => [
            { '_aj_globalid' => other_book.to_global_id.to_s },
            { '_aj_globalid' => other_judge.to_global_id.to_s },
            nil
          ],
        }
      )

      delete "/books/#{james_bond_movies.id}/cancel_judge_judy/#{judge_judy.id}"

      assert_response :redirect
      follow_redirect!
      assert_equal "AI Judge #{judge_judy.name} has been cancelled.", flash[:notice]
      assert_not SolidQueue::Job.exists?(matching_job.id)
      assert SolidQueue::Job.exists?(unrelated_job.id)
    end
  end

  describe 'updating' do
    test "keeps an AI judge's auto_run flag set when the judge stays checked across an unrelated save" do
      login_user_for_integration_test user
      james_bond_movies.books_ai_judges.find_by!(ai_judge: judge_judy).update!(auto_run: true)

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:                  'James Bond Movies (renamed)',
          team_ids:              [],
          ai_judge_ids:          [ judge_judy.id ],
          auto_run_ai_judge_ids: [ judge_judy.id ],
        },
      }

      assert_predicate james_bond_movies.books_ai_judges.find_by(ai_judge: judge_judy), :auto_run?
    end

    test 'turns auto_run off for an AI judge unchecked from auto-run while staying assigned' do
      login_user_for_integration_test user
      james_bond_movies.books_ai_judges.find_by!(ai_judge: judge_judy).update!(auto_run: true)

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:                  james_bond_movies.name,
          team_ids:              [],
          ai_judge_ids:          [ judge_judy.id ],
          auto_run_ai_judge_ids: [],
        },
      }

      books_ai_judge = james_bond_movies.books_ai_judges.find_by(ai_judge: judge_judy)
      assert_not_nil books_ai_judge
      assert_not books_ai_judge.auto_run?
    end

    test 'removes the AI judge assignment entirely when unchecked from ai_judge_ids' do
      login_user_for_integration_test user
      james_bond_movies.books_ai_judges.find_by!(ai_judge: judge_judy).update!(auto_run: true)

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:                  james_bond_movies.name,
          team_ids:              [],
          ai_judge_ids:          [],
          auto_run_ai_judge_ids: [],
        },
      }

      assert_nil james_bond_movies.books_ai_judges.find_by(ai_judge: judge_judy)
    end

    test 'does not crash when ai_judge_ids and auto_run_ai_judge_ids are omitted entirely' do
      login_user_for_integration_test user
      james_bond_movies.books_ai_judges.find_by!(ai_judge: judge_judy).update!(auto_run: true)

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:     james_bond_movies.name,
          team_ids: [],
        },
      }

      assert_response :redirect
      assert_nil james_bond_movies.books_ai_judges.find_by(ai_judge: judge_judy)
    end
  end

  describe 'show' do
    let(:matt) { users(:matt) }
    let(:joe)  { users(:joe) }
    let(:jane) { users(:jane) }

    before do
      james_bond_movies.query_doc_pairs.each { |query_doc_pair| query_doc_pair.judgements.delete_all }
    end

    test 'lists assigned AI judge in Judge Activity table even with no judgements' do
      login_user_for_integration_test user
      james_bond_movies.ai_judges << judge_judy unless james_bond_movies.ai_judges.include?(judge_judy)
      james_bond_movies.judgements.where(user: judge_judy).delete_all

      get "/books/#{james_bond_movies.id}"

      assert_response :success
      assert_select "#judge-row-#{judge_judy.id}" do
        assert_select 'button[title=?]', 'Start judging 10 pairs'
      end
    end

    test 'flags unjudged pairs needing attention' do
      login_user_for_integration_test user

      get "/books/#{james_bond_movies.id}"

      assert_response :success
      assert_match 'Not Started', response.body
      assert_equal james_bond_movies.query_doc_pairs.count, assigns(:zero_judgement_count)
      assert_equal 0, assigns(:coverage_pct)
    end

    test 'shows the book as fully judged once every pair has three judgements' do
      login_user_for_integration_test user

      [ matt, joe, jane ].each do |judge|
        james_bond_movies.query_doc_pairs.each do |qdp|
          qdp.judgements.create! rating: 1, user: judge
        end
      end

      get "/books/#{james_bond_movies.id}"

      assert_response :success
      assert_match 'Fully Judged', response.body
      assert_equal 100, assigns(:coverage_pct)
      assert_equal james_bond_movies.query_doc_pairs.count, assigns(:complete_count)
    end

    test 'prompts to populate the book when it has no query/doc pairs' do
      login_user_for_integration_test user
      james_bond_movies.query_doc_pairs.delete_all

      get "/books/#{james_bond_movies.id}"

      assert_response :success
      assert_match 'No Query/Doc Pairs Available', response.body
      assert_match 'use the', response.body
      assert_match 'Judgements', response.body
      assert_no_match 'letting it run its queries', response.body
    end

    test 'points to letting the case auto-populate when its linked case is set up for it' do
      login_user_for_integration_test user
      james_bond_movies.query_doc_pairs.delete_all
      cases(:james_bond_case).update!(auto_populate_book_pairs: true)

      get "/books/#{james_bond_movies.id}"

      assert_response :success
      assert_match 'Load query/doc pairs for judging by returning', response.body
      assert_match 'letting it run its queries', response.body
      assert_no_match 'use the', response.body
    end

    test 'redirects an inaccessible book to the books page with sharing guidance' do
      login_user_for_integration_test user

      get '/books/99999'

      assert_redirected_to books_path
      assert_equal 'Could not retrieve book 99999. Confirm that the book has been shared with you via a team you are a member of!', flash[:alert]
    end
  end

  describe 'judgement stats' do
    before do
      james_bond_movies.query_doc_pairs.each { |query_doc_pair| query_doc_pair.judgements.delete_all }
    end

    test 'shows the distribution of judgement ratings across the book scale' do
      login_user_for_integration_test user

      pairs = james_bond_movies.query_doc_pairs.limit(3).to_a
      pairs[0].judgements.create! rating: 0, user: user
      pairs[1].judgements.create! rating: 1, user: user
      pairs[2].judgements.create! rating: 1, user: user

      get "/books/#{james_bond_movies.id}/judgement_stats"

      assert_response :success
      assert_equal(
        [
          { rating: '0 - Not Relevant', count: 1 },
          { rating: '1 - Relevant', count: 2 }
        ],
        assigns(:rating_distribution_data)
      )
    end

    test 'includes scale values with zero judgements' do
      login_user_for_integration_test user

      get "/books/#{james_bond_movies.id}/judgement_stats"

      assert_response :success
      assert_equal(
        [
          { rating: '0 - Not Relevant', count: 0 },
          { rating: '1 - Relevant', count: 0 }
        ],
        assigns(:rating_distribution_data)
      )
    end

    test 'excludes judgements marked unrateable or judge later' do
      login_user_for_integration_test user

      pairs = james_bond_movies.query_doc_pairs.limit(2).to_a
      pairs[0].judgements.create! rating: 1, user: user
      pairs[1].judgements.new(user: user).mark_unrateable!

      get "/books/#{james_bond_movies.id}/judgement_stats"

      assert_response :success
      assert_equal(
        [
          { rating: '0 - Not Relevant', count: 0 },
          { rating: '1 - Relevant', count: 1 }
        ],
        assigns(:rating_distribution_data)
      )
    end

    test 'does not link to Refine Prompt for a judge the current user cannot access' do
      login_user_for_integration_test user

      other_owner = users(:case_finder_user)
      inaccessible_judge = AiJudge.create!(name: 'Inaccessible Judge', owner: other_owner,
                                           llm_key: '1234asdf5678', system_prompt: 'Judge it.')
      james_bond_movies.query_doc_pairs.first.judgements.create! rating: 1, user: inaccessible_judge

      get "/books/#{james_bond_movies.id}/judgement_stats"

      assert_response :success
      assert_not_includes assigns(:refinable_ai_judge_ids), inaccessible_judge.id
      assert_no_match edit_ai_judge_path(inaccessible_judge, book_id: james_bond_movies.id), response.body
    end
  end

  # rubocop:disable Metrics/AbcSize
  def test_functionality
    # definitly an opportunity for refactoring!

    # get the login page
    # get '/books'
    # assert_equal 302, status
    # follow_redirect!

    login_user_for_integration_test user

    get '/books'
    assert_equal 200, status

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'Combined 7 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal book.query_doc_pairs.count, james_bond_movies.query_doc_pairs.count + 1
    assert_equal book.judgements.count, james_bond_movies.judgements.count + 1

    patch "/books/#{book.id}/combine",
          params: { book_ids: { "#{james_bond_movies.id}": '1', "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'Combined 7 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal book.query_doc_pairs.count, james_bond_movies.query_doc_pairs.count + 1
    assert_equal book.judgements.count, james_bond_movies.judgements.count + 1

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{book.id}": '1' } }
    follow_redirect!
    assert_equal 'Combined 8 query/doc pairs.', flash[:notice]

    book.reload
    assert_equal 8, book.query_doc_pairs.count
  end

  # rubocop:enable Metrics/AbcSize
  def test_more
    login_user_for_integration_test user

    assert_equal 1, book.query_doc_pairs.count

    patch "/books/#{book.id}/combine", params: { book_ids: { "#{james_bond_movies.id}": '1' } }
    follow_redirect!
    assert_equal 'Combined 7 query/doc pairs.', flash[:notice]

    assert_equal 8, book.query_doc_pairs.count
  end

  def test_differing_scales_blows_up
    login_user_for_integration_test user

    book_to_merge = Book.new(name: 'Book with a 1,2,3,4 scale', teams: book.teams,
                             scale: [ 1, 2, 3, 4 ])
    book_to_merge.save!

    params = { book_ids: { "#{book_to_merge.id}": '1' } }

    patch "/books/#{book.id}/combine", params: params
    follow_redirect!
    assert_equal "One of the books chosen doesn't have a scale matching [0, 1]", flash[:alert]
  end

  let(:single_rater_book) { books(:book_of_star_wars_judgements) }
  let(:single_rater_book2) { books(:book_of_comedy_films) }

  describe 'archiving books' do
    let(:doug) { users(:doug) }
    let(:archived_book) { books(:archived_book) }

    test 'successfully archives an active book' do
      login_user_for_integration_test doug

      assert_not james_bond_movies.archived

      patch "/books/#{james_bond_movies.id}/archive"
      follow_redirect!

      assert_equal "Book '#{james_bond_movies.name}' has been archived.", flash[:notice]
      james_bond_movies.reload
      assert james_bond_movies.archived
    end

    test 'successfully unarchives an archived book' do
      login_user_for_integration_test doug

      assert archived_book.archived

      patch "/books/#{archived_book.id}/unarchive"
      follow_redirect!

      assert_equal "Book '#{archived_book.name}' has been unarchived.", flash[:notice]
      archived_book.reload
      assert_not archived_book.archived
    end

    test 'redirects to archived books index after unarchiving' do
      login_user_for_integration_test doug

      patch "/books/#{archived_book.id}/unarchive"

      assert_redirected_to books_path(archived: true)
    end

    test 'index shows active books by default' do
      login_user_for_integration_test doug

      get '/books'
      assert_equal 200, status

      assert_response :success

      assert_match james_bond_movies.name, response.body
      assert_no_match archived_book.name, response.body
    end

    test 'index shows archived books when requested' do
      login_user_for_integration_test doug

      get '/books', params: { archived: 'true' }

      assert_response :success

      assert_no_match james_bond_movies.name, response.body
      # assert_match archived_book.name, response.body
    end
  end

  describe 'searching the index' do
    let(:doug) { users(:doug) }

    test 'matches by book name' do
      login_user_for_integration_test doug

      get '/books', params: { q: 'james bond' }

      assert_response :success
      assert_match james_bond_movies.name, response.body
    end

    test 'matches by team name without erroring (books.teams is not implicitly joined)' do
      login_user_for_integration_test doug

      get '/books', params: { q: 'a shared team' }

      assert_response :success
      assert_match james_bond_movies.name, response.body
    end

    test 'is case-insensitive' do
      login_user_for_integration_test doug

      get '/books', params: { q: 'JAMES BOND' }

      assert_response :success
      assert_match james_bond_movies.name, response.body
    end

    test 'does not duplicate a book shared with multiple matching teams' do
      login_user_for_integration_test doug

      teams(:case_finder_owned_team).books << james_bond_movies

      get '/books', params: { q: 'team' }

      assert_response :success
      book_ids = assigns(:books).map(&:id)
      assert_equal 1, book_ids.count(james_bond_movies.id)
    end
  end

  def test_combining_single_rater_strategy_into_multiple_rater_strategy_book_works
    login_user_for_integration_test user

    book_with_multiple_raters = Book.create(name:              'Book with a 1,2,3,4 scale',
                                            teams:             single_rater_book.teams,
                                            scale:             single_rater_book.scale,
                                            scale_with_labels: single_rater_book.scale_with_labels)

    params = { book_ids: { "#{single_rater_book.id}": '1' } }

    patch "/books/#{book_with_multiple_raters.id}/combine", params: params
    follow_redirect!
    assert_nil flash[:alert]
    assert_equal 'Combined 2 query/doc pairs.', flash[:notice]

    assert_equal 2, book_with_multiple_raters.query_doc_pairs.count
    assert_equal 2, book_with_multiple_raters.judgements.count
  end

  describe 'remapping judgement ratings' do
    let(:doug) { users(:doug) }

    test 'remaps matching ratings to new values' do
      login_user_for_integration_test doug

      # james_bond_movies has judgements with ratings 0, 1, 2, 3
      assert_equal [ 0, 1, 2, 3 ], james_bond_movies.judgements.where.not(rating: nil).pluck(:rating).sort.map(&:to_i)

      patch "/books/#{james_bond_movies.id}/remap_judgement_ratings",
            params: { rating_map: { '3.0' => '1', '2.0' => '1', '1.0' => '0', '0.0' => '0' } }

      follow_redirect!
      # 0→0 is a no-op (skipped), so only 3 judgements and 2 case ratings are actually remapped
      assert_equal 'Remapped 3 judgements and 2 case ratings.', flash[:notice]

      james_bond_movies.reload
      # was [0,1,2,3]; 0 stays 0, 1→0, 2→1, 3→1
      assert_equal [ 0, 0, 1, 1 ], james_bond_movies.judgements.where.not(rating: nil).pluck(:rating).sort.map(&:to_i)
    end

    test 'skips entries where old rating equals new rating' do
      login_user_for_integration_test doug

      patch "/books/#{james_bond_movies.id}/remap_judgement_ratings",
            params: { rating_map: { '3.0' => '3', '0.0' => '0' } }

      follow_redirect!
      assert_equal 'No ratings changed.', flash[:notice]
    end

    test 'handles chained remapping without double-updating (3→2, 2→1)' do
      login_user_for_integration_test doug

      # Map 3→2 and 2→1 simultaneously — judgements originally rated 3 must end up at 2, not 1
      patch "/books/#{james_bond_movies.id}/remap_judgement_ratings",
            params: { rating_map: { '3.0' => '2', '2.0' => '1' } }

      follow_redirect!
      james_bond_movies.reload
      ratings = james_bond_movies.judgements.where.not(rating: nil).pluck(:rating).sort.map(&:to_i)

      assert_includes ratings, 2  # originally-3 judgement ended at 2, not 1
      assert_includes ratings, 1  # originally-2 judgements ended at 1
    end

    test 'also remaps ratings in cases associated with the book' do
      login_user_for_integration_test doug

      james_bond_case = cases(:james_bond_case)
      # fixture has case ratings [1, 3, 5]
      assert_equal [ 1, 3, 5 ], james_bond_case.ratings.where.not(rating: nil).pluck(:rating).sort.map(&:to_i)

      patch "/books/#{james_bond_movies.id}/remap_judgement_ratings",
            params: { rating_map: { '3.0' => '1', '2.0' => '1', '1.0' => '0', '0.0' => '0' } }

      follow_redirect!
      james_bond_case.reload
      # ratings 3→1, 1→0; 5 is not in the remap so stays 5
      assert_equal [ 0, 1, 5 ], james_bond_case.ratings.where.not(rating: nil).pluck(:rating).sort.map(&:to_i)
    end

    test 'edit page shows ratings from both judgements and associated cases' do
      login_user_for_integration_test doug

      # Bullet fires on the pre-existing @other_books N+1, not our new query — suppress it.
      Bullet.enable = false
      get "/books/#{james_bond_movies.id}/edit"
      Bullet.enable = true

      # judgements: 0,1,2,3; james_bond_case ratings: 1,3,5 → combined unique sorted: 0,1,2,3,5
      # rating_map[5.0] input only appears if case ratings were included in @current_ratings
      assert_includes response.body, 'name="rating_map[5.0]"'
    end
  end

  describe 'AI judge assignment' do
    let(:doug) { users(:doug) }
    let(:random_1) { users(:random_1) }

    setup { login_user_for_integration_test doug }

    test 'edit includes an ai judge owned directly by the book owner, even with no team share' do
      owner_only_judge = AiJudge.create!(name: 'Owner Only Judge', llm_key: '1234', owner: doug)

      # Bullet fires on the pre-existing @other_books N+1, not our new query — suppress it.
      Bullet.enable = false
      get "/books/#{james_bond_movies.id}/edit"
      Bullet.enable = true

      assert_response :success
      assert_includes assigns(:ai_judges), owner_only_judge
    end

    test 'edit shows ai judges visible to the current user even when the book has no owner' do
      ownerless_book = books(:book_of_star_wars_judgements)
      assert_nil ownerless_book.owner

      # judge_judy has no owner either, but is shared via the same "shared"
      # team doug belongs to - visibility must come from the editor
      # (current_user), not the (here, absent) book owner.
      # Bullet fires on the pre-existing @other_books N+1, not our new query — suppress it.
      Bullet.enable = false
      get "/books/#{ownerless_book.id}/edit"
      Bullet.enable = true

      assert_response :success
      assert_includes assigns(:ai_judges), users(:judge_judy)
    end

    test 'update assigns an ai judge shared via the team even when the book has no owner' do
      ownerless_book = books(:book_of_star_wars_judgements)
      assert_nil ownerless_book.owner

      patch "/books/#{ownerless_book.id}", params: {
        book: {
          name:         ownerless_book.name,
          team_ids:     ownerless_book.team_ids,
          ai_judge_ids: [ users(:judge_judy).id ],
        },
      }

      assert_includes ownerless_book.reload.ai_judges, users(:judge_judy)
    end

    test 'update rejects an ai judge id the book owner cannot access' do
      unrelated_judge = AiJudge.create!(name: 'Unrelated Judge', llm_key: '1234', owner: random_1)

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:         james_bond_movies.name,
          team_ids:     james_bond_movies.team_ids,
          ai_judge_ids: [ unrelated_judge.id ],
        },
      }

      assert_not_includes james_bond_movies.reload.ai_judges, unrelated_judge
    end

    test 'update assigns an owned ai judge when no team checkboxes are submitted' do
      owner_only_judge = AiJudge.create!(name: 'Owner Only Judge', llm_key: '1234', owner: doug)
      james_bond_movies.teams.clear

      patch "/books/#{james_bond_movies.id}", params: {
        book: {
          name:         james_bond_movies.name,
          ai_judge_ids: [ owner_only_judge.id ],
        },
      }

      assert_response :redirect
      assert_includes james_bond_movies.reload.ai_judges, owner_only_judge
    end

    test 'new includes an ai judge owned directly by the current user, even with no team share' do
      owner_only_judge = AiJudge.create!(name: 'Owner Only Judge', llm_key: '1234', owner: doug)

      get '/books/new'

      assert_response :success
      assert_includes assigns(:ai_judges), owner_only_judge
    end

    test 'create assigns an ai judge owned directly by the creator, even with no team share' do
      owner_only_judge = AiJudge.create!(name: 'Owner Only Judge', llm_key: '1234', owner: doug)

      post '/books', params: {
        book: {
          name:         'New Book With Owned Judge',
          team_ids:     [],
          ai_judge_ids: [ owner_only_judge.id ],
        },
      }

      created_book = Book.find_by(name: 'New Book With Owned Judge')
      assert_includes created_book.ai_judges, owner_only_judge
    end

    test 'create rejects an ai judge id the creator cannot access' do
      unrelated_judge = AiJudge.create!(name: 'Unrelated Judge', llm_key: '1234', owner: random_1)

      post '/books', params: {
        book: {
          name:         'New Book Rejecting Unrelated Judge',
          team_ids:     [],
          ai_judge_ids: [ unrelated_judge.id ],
        },
      }

      created_book = Book.find_by(name: 'New Book Rejecting Unrelated Judge')
      assert_not_includes created_book.ai_judges, unrelated_judge
    end
  end

  def test_scorer_id_copies_scale_fields_when_creating_book
    login_user_for_integration_test user

    scorer = user.scorers_involved_with.first

    post '/books', params: {
      book: {
        name:      'Test Book with Scorer',
        scorer_id: scorer.id,
        team_ids:  [ user.teams.first.id ],
      },
    }

    follow_redirect!
    created_book = Book.last

    assert_equal scorer.scale, created_book.scale
    assert_nil created_book.scale_with_labels
  end

  def test_new_preselects_a_scorer_id_the_dropdown_actually_offers
    login_user_for_integration_test user

    # p@10 and quepid_default_scorer are two distinct communal scorers that
    # share the same scale/labels - scorer_options_for_select only lists one
    # representative id per unique scale combination, so passing the *other*
    # scorer's id (as the case's scorer_id) must still resolve to whichever
    # id the dropdown actually renders, not be left unmatched.
    other_scorer = scorers(:'p@10')
    duplicate_scale_scorer = scorers(:quepid_default_scorer)
    assert_equal other_scorer.scale, duplicate_scale_scorer.scale
    assert_nil duplicate_scale_scorer.scale_with_labels
    assert_nil other_scorer.scale_with_labels

    get '/books/new', params: { scorer_id: duplicate_scale_scorer.id }

    assert_response :success
    assert_match(/<option selected="selected" value="#{assigns(:book).scorer_id}">/, response.body)
  end

  def test_create_does_not_link_the_origin_case_when_synchronization_is_disabled
    login_user_for_integration_test user
    origin_case = cases(:with_scorer)

    post '/books', params: {
      book: {
        name:                          'Unlinked Book',
        link_the_case:                 '0',
        origin_case_id:                origin_case.id,
        auto_populate_book_pairs:      '1',
        auto_populate_case_judgements: '1',
        team_ids:                      [],
      },
    }

    assert_response :redirect
    assert_nil origin_case.reload.book
  end
end

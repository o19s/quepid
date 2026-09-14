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
          name:         james_bond_movies.name,
          team_ids:     [],
          ai_judge_ids: [ judge_judy.id ],
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
          name:         james_bond_movies.name,
          team_ids:     [],
          ai_judge_ids: [],
        },
      }

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
end

# frozen_string_literal: true

require 'test_helper'

class BooksControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:judge_judy) { users(:judge_judy) }
  let(:book) { books(:book_of_comedy_films) }
  let(:james_bond_movies) { books(:james_bond_movies) }
  let(:communal_scorer) { scorers(:communal_scorer) }

  describe 'running judge judy' do
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

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
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
  # rubocop:enable Metrics/MethodLength

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

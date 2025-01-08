# frozen_string_literal: true

require 'test_helper'

class JudgeJudyFlowTest < ActionDispatch::IntegrationTest
  let(:book) { books(:james_bond_movies) }
  let(:acase) { cases(:shared_with_team) }
  let(:team) { teams(:shared) }
  let(:user) { users(:random) }

  test 'Demonstrate how to work with Judge Judy' do
    post users_login_url params: { user: { email: user.email, password: 'password' }, format: :json }

    assert_empty(acase.queries)
    assert_empty(acase.ratings)

    assert_includes user.teams, team
    assert_includes acase.teams, team
    assert_includes book.teams, team

    assert_equal 7, book.query_doc_pairs.size

    # Set up Judge Judy.  Give her a prompt (and an OPENAI KEY)
    judge_judy = User.new name: 'judge judy', email: 'judgejudy@quepid.com', password: 'password'

    # Add her to the team
    judge_judy.teams << team
    judge_judy.save!

    # Add her to the book's list of ai_judges
    book.ai_judges << judge_judy
    book.save!

    # Wait for her to judge
    perform_enqueued_jobs do
      # patch :update, params: data
      RunJudgeJudyJob.perform_later(book, judge_judy)
    end

    book.reload

    # make sure every query_doc_pair has a rating by Judge Judy.
    assert_equal book.query_doc_pairs.size, book.judgements.where(user: judge_judy).size

    # Link to a Case and Book together and populate it.
    put api_case_url acase, params: { case_id: acase.id, case: { book_id: book.id }, format: :json }
    assert_response :ok

    acase.reload

    assert_equal acase.book, book

    # Add a query to the case --> and then rate it to create rating.
    post api_case_queries_url acase,
                              params: { case_id: acase.id,
                                        query:   { query_text: 'what is the average velocity of a swallow?' } }
    assert_response :ok
    response_json = response.parsed_body
    query = Query.find(response_json['query']['query_id'])

    rating = {
      doc_id: 'african_swallow',
      rating: 1,
    }

    put api_case_query_ratings_url acase, query, params: { case_id: acase.id, query_id: query.id, rating: rating }
    assert_response :ok
    puts response.parsed_body
    rating = Rating.find(response.parsed_body['id'])

    # make sure Judge Judy didn't get involved'
    # we don' want users tracked at the case rating level
    assert_nil rating.user
    # assert_equal rating.user, user
    assert_equal rating.rating, 1

    # Here is the big question, if I rate something in the main UI, how is that handled?
    # I worry that if a case rating creates/updates a book judgement, and that triggers a
    # update the case that we get weird round tripping.  Really want ratings to be book --> Case

    data = {
      book_id:         book.id,
      case_id:         acase.id,
      query_doc_pairs: [
        {
          query_text:      query.query_text,
          doc_id:          rating.doc_id,
          rating:          rating.rating,
          user_id:         user.id,
          position:        0,
          document_fields: {
            title: 'Monty Python Quest for Holy Grail',
            year:  '1987',
          },
        }
      ],
    }

    perform_enqueued_jobs do
      assert_difference 'book.query_doc_pairs.count' do
        put api_book_populate_url book, params: data
        assert_response :no_content
      end
    end
    book.reload
    assert_equal book.query_doc_pairs.size, book.judgements.where(user: judge_judy).size

    query_doc_pairs = book.query_doc_pairs.where(query_text: query.query_text, doc_id: rating.doc_id)
    assert_equal query_doc_pairs.count, 1

    judgements = query_doc_pairs.first.judgements
    assert_equal 2, judgements.count

    rating.reload

    # See that the original case rating has changed to be the average of
    # Judge Judy with a 4 and User with 1.   (1+4)/2 = 2.5 rounded to 3.0
    assert_equal rating.rating, 3.0
    assert_nil rating.user # I think that having a "last user who rated" wasn't good idea.'
  end
end

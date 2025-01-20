# frozen_string_literal: true

require 'test_helper'

class CaseToBookToCaseFlowTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper
  include ActiveJob::TestHelper

  let(:kase) { cases(:random_case) }
  let(:book) { books(:empty_book) }
  let(:team) { teams(:shared) }
  let(:user) { users(:doug) }

  test 'Create a book from a case, and then create a new case from that book' do
    post users_login_url params: { user: { email: user.email, password: 'password' }, format: :json }

    kase.owner = user
    kase.save!

    book.owner = user
    book.save!

    # populate the book
    data = {
      book_id:         book.id,
      case_id:         kase.id,
      query_doc_pairs: [
        {
          query_text:      'Best Bond Ever',
          doc_id:          'https://www.themoviedb.org/movie/708-the-living-daylights',
          position:        0,
          document_fields: {
            title: 'The Living Daylights',
            year:  '1987',
          },
        }
      ],
    }

    put api_book_populate_url book, params: data

    assert_response :no_content

    # print_jobs

    assert_enqueued_jobs 2, except: Ahoy::GeocodeV2Job

    perform_enqueued_jobs

    assert_performed_jobs 2, except: Ahoy::GeocodeV2Job

    # the new Case that we will populate from a book...
    new_case = Case.create(case_name: 'test case', owner: user)

    put api_book_case_refresh_url book, new_case, params: { create_missing_queries: true }

    new_case.reload
    assert_not_empty new_case.queries

    old_query = kase.queries.find_by(query_text: 'Best Bond Ever')
    new_query = new_case.queries.find_by(query_text: 'Best Bond Ever')

    assert_not_equal old_query.arranged_next, new_query.arranged_next

    assert_equal old_query.information_need, new_query.information_need
    assert_equal old_query.notes, new_query.notes
    assert_equal old_query.options, new_query.options
  end

  def print_jobs
    enqueued_jobs.each do |job|
      puts "Job: #{job[:job]}, Arguments: #{job[:args].inspect}"
    end
  end
end

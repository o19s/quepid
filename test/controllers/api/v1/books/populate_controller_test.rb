# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    module Books
      class PopulateControllerTest < ActionController::TestCase
        let(:acase)                 { cases(:case_with_book) }
        let(:user)                  { users(:random) }
        let(:team)                  { teams(:shared) }
        let(:book)                  { books(:book_of_star_wars_judgements) }

        before do
          @controller = Api::V1::Books::PopulateController.new

          login_user user
        end

        describe 'populate empty book' do
          test 'creates all query doc pairs' do
            book.query_doc_pairs.destroy_all
            expects_any_ga_event_call 'books:populated_empty_book', {
              category: 'Books',
              action:   'Populated empty book',
              label:    book.name,
              value:    book.id,
            }

            data = {
              book_id:         book.id,
              case_id:         acase.id,
              query_doc_pairs: [
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/11-star-wars',
                  position:        0,
                  document_fields: {
                    title: 'Star Wars',
                    year:  '1977',
                  },
                },
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/782054-2021',
                  position:        1,
                  document_fields: {
                    title: 'Doraemon: Nobita\'s Little Star Wars 2021',
                    year:  '2022',
                  },
                }
              ],
            }

            assert_difference 'book.query_doc_pairs.count', 2 do
              put :update, params: data

              assert_enqueued_with(job: PopulateBookJob)

              perform_enqueued_jobs

              query_doc_pair_star_wars = book.query_doc_pairs.find_by(query_text: 'star wars', doc_id: 'https://www.themoviedb.org/movie/11-star-wars')
              assert_not_nil query_doc_pair_star_wars
              assert_empty query_doc_pair_star_wars.judgements

              assert_equal data[:query_doc_pairs][0][:document_fields].symbolize_keys, query_doc_pair_star_wars.document_fields.symbolize_keys

              assert_response :no_content
            end
          end
        end

        describe 'a sync is already queued or running for the book' do
          test 'rejects the request without enqueuing another job' do
            book.update(populate_job: "queued at #{Time.zone.now}")

            data = {
              book_id:         book.id,
              case_id:         acase.id,
              query_doc_pairs: [
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/11-star-wars',
                  position:        0,
                  document_fields: {
                    title: 'Star Wars',
                    year:  '1977',
                  },
                }
              ],
            }

            assert_no_enqueued_jobs do
              put :update, params: data
            end

            assert_response :conflict
          end
        end

        test 'queues all 101 queries together and accepts a rejected payload after job completion' do
          expects_any_ga_event_call
          pairs = 101.times.map do |index|
            query_text = "bulk sync query #{index}"
            acase.queries.create!(query_text: query_text)
            {
              query_text:      query_text,
              doc_id:          "bulk-doc-#{index}",
              position:        1,
              document_fields: { title: "Document #{index}" },
            }
          end
          data = { book_id: book.id, case_id: acase.id, query_doc_pairs: pairs }

          assert_enqueued_jobs 1, only: PopulateBookJob do
            put :update, params: data
            assert_response :no_content
          end
          assert_not_nil book.reload.populate_job
          assert_equal 0, book.query_doc_pairs.where(query_text: pairs.pluck(:query_text)).count

          retry_data = data.merge(query_doc_pairs: [ pairs.first.merge(doc_id: 'retry-doc') ])
          assert_no_enqueued_jobs do
            put :update, params: retry_data
            assert_response :conflict
          end

          perform_enqueued_jobs
          assert_nil book.reload.populate_job
          assert_equal 101, book.query_doc_pairs.where(query_text: pairs.pluck(:query_text)).count

          perform_enqueued_jobs do
            put :update, params: retry_data
            assert_response :no_content
          end
          assert_equal 102, book.query_doc_pairs.where(query_text: pairs.pluck(:query_text)).count
          assert_equal 1, book.query_doc_pairs.find_by!(doc_id: 'retry-doc').position
        end

        describe 'refresh a existing book' do
          test 'updates the position and doc fields' do
            assert_not_empty book.query_doc_pairs
            expects_any_ga_event_call 'books:refreshed_a_book', {
              category: 'Books',
              action:   'Refreshed a book',
              label:    book.name,
              value:    book.id,
            }

            data = {
              book_id:         book.id,
              case_id:         acase.id,
              query_doc_pairs: [
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/11-star-wars',
                  position:        0,
                  document_fields: {
                    title: 'Star Wars',
                    year:  '1977',
                  },
                },
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/782054-2021',
                  position:        1,
                  document_fields: {
                    title: 'Doraemon: Nobita\'s Little Star Wars 2021',
                    year:  '2022',
                  },
                }
              ],
            }

            put :update, params: data

            assert_enqueued_with(job: PopulateBookJob)
            perform_enqueued_jobs

            # change position and document fields to test
            data[:query_doc_pairs][0][:document_fields][:year] = '3000'

            data[:query_doc_pairs][1][:position] = 2
            data[:query_doc_pairs][1][:document_fields][:director] = 'Susumu Yamaguchi'
            assert_difference 'book.query_doc_pairs.count', 0 do
              put :update, params: data

              assert_enqueued_with(job: PopulateBookJob)
              perform_enqueued_jobs

              query_doc_pair_star_wars = book.query_doc_pairs.find_by(query_text: 'star wars', doc_id: 'https://www.themoviedb.org/movie/11-star-wars')
              assert_not_nil query_doc_pair_star_wars

              assert_equal data[:query_doc_pairs][0][:document_fields].symbolize_keys, query_doc_pair_star_wars.document_fields.symbolize_keys
              assert_equal data[:query_doc_pairs][0][:position], query_doc_pair_star_wars.position

              query_doc_pair_doramon = book.query_doc_pairs.find_by(query_text: 'star wars', doc_id: 'https://www.themoviedb.org/movie/782054-2021')
              assert_not_nil query_doc_pair_doramon

              assert_equal data[:query_doc_pairs][1][:document_fields].symbolize_keys, query_doc_pair_doramon.document_fields.symbolize_keys
              assert_equal data[:query_doc_pairs][1][:position], query_doc_pair_doramon.position

              assert_response :no_content
            end
          end

          test 'updates with a new query doc pair' do
            data = {
              book_id:         book.id,
              case_id:         acase.id,
              query_doc_pairs: [
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/11-star-wars',
                  position:        0,
                  document_fields: {
                    title: 'Star Wars',
                    year:  '1977',
                  },
                },
                {
                  query_text:      'star wars',
                  doc_id:          'https://www.themoviedb.org/movie/782054-2021',
                  position:        1,
                  document_fields: {
                    title: 'Doraemon: Nobita\'s Little Star Wars 2021',
                    year:  '2022',
                  },
                }
              ],
            }

            perform_enqueued_jobs do
              put :update, params: data
            end

            query_doc_pair = {
              query_text:      'star wars',
              doc_id:          'https://www.themoviedb.org/movie/140607-star-wars-the-force-awakens',
              position:        3,
              document_fields: {
                title: 'Star Wars: The Force Awakens',
                year:  '2015',
              },
            }

            data[:query_doc_pairs] << query_doc_pair

            assert_difference 'book.query_doc_pairs.count', 1 do
              put :update, params: data

              assert_enqueued_with(job: PopulateBookJob)
              perform_enqueued_jobs

              assert_response :no_content
            end
          end

          test 'clear position for qdp pushed out of the rating window by new qdp entries' do
            qdps = book.query_doc_pairs.where(query_text: 'Han')
            bottom_qdp = qdps.max_by(&:position)

            data = {
              book_id:         book.id,
              case_id:         acase.id,
              query_doc_pairs: [
                {
                  query_text:      'Han',
                  doc_id:          'https://www.themoviedb.org/movie/1892-return-of-the-jedi',
                  position:        bottom_qdp.position,
                  document_fields: {
                    title: 'Return of the Jedi',
                    year:  '1982',
                  },
                }
              ],
            }

            assert_difference 'book.query_doc_pairs.count', 1 do
              put :update, params: data

              perform_enqueued_jobs

              assert_response :no_content
            end

            bottom_qdp.reload

            assert_nil bottom_qdp.position # make sure position was cleared
            assert_equal 1,
                         book.query_doc_pairs.where(query_text: 'Han', position: bottom_qdp.position).count
          end
        end
      end
    end
  end
end

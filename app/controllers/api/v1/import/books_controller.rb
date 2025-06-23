# frozen_string_literal: true

module Api
  module V1
    module Import
      class BooksController < Api::ApiController
        # rubocop:disable Metrics/MethodLength
        # @summary Import a complete book
        # @tags books > import
        # @request_body Book to be imported
        #   [
        #     !Hash{
        #       team_id: Integer,
        #       book: Hash{
        #         name: String,
        #         scorer: Hash{
        #           name: String
        #         },
        #         selection_strategy: Hash{
        #           name: String
        #         },
        #         query_doc_pairs: Array<
        #           Hash{
        #             query_text: String,
        #             doc_id: String
        #           }
        #         >
        #       }
        #     }
        #   ]
        # @request_body_example basic book
        #   [JSON{
        #     "team_id": 1,
        #     "book": {
        #       "name": "bob",
        #       "scorer": {
        #         "name": "nDCG@10"
        #       },
        #       "selection_strategy": {
        #         "name": "Multiple Raters"
        #       },
        #       "query_doc_pairs": [
        #         {
        #           "query_text": "Ice Age",
        #           "doc_id": 425,
        #           "position": 1,
        #           "document_fields": "{\"overview\":\"With the impending flood...\",\"cast\":\"Ray Romano John\"",
        #           "information_need": "Fun kids animated movie with sid the sloth",
        #           "notes": "this is an important query",
        #           "options": "",
        #           "judgements": [
        #             {
        #               "rating": 3.0,
        #               "user_email": "epugh@opensourceconnections.com"
        #             },
        #             {
        #               "rating": 2.0,
        #               "user_email": "judge_judy@opensourceconnections.com"
        #             }
        #           ]
        #         }
        #       ]
        #     }
        #   }]
        #
        # > Notice that `document_fields` contains an string encoded JSON!
        def create
          team_id = params.require(:team_id)
          params_to_use = book_params.to_h.deep_symbolize_keys

          @book = Book.new

          @book.teams << Team.find(team_id)
          options = {}
          book_importer = ::BookImporter.new @book, @current_user, params_to_use, options

          book_importer.validate

          unless @book.errors.empty?
            render json: @book.errors, status: :bad_request
            return
          end

          if book_importer.import
            respond_with @book
          else
            render json: @book.errors, status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength

        private

        def book_params
          params.require(:book).permit!
        end
      end
    end
  end
end

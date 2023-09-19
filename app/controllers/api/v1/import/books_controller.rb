# frozen_string_literal: true

module Api
  module V1
    module Import
      class BooksController < Api::ApiController
        # before_action :find_book
        # before_action :check_case

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        # rubocop:disable Layout/LineLength
        def create
          team_id = params.require(:team_id)
          params_to_use = book_params.to_h.deep_symbolize_keys

          @book = Book.new

          @book.team = Team.find(team_id)

          scorer_name = params_to_use[:scorer][:name]
          unless Scorer.exists?(name: scorer_name)
            @book.errors.add(:base, "Scorer with name '#{scorer_name}' needs to be migrated over first.")
          end

          selection_strategy_name = params_to_use[:selection_strategy][:name]
          unless SelectionStrategy.exists?(name: selection_strategy_name)
            @book.errors.add(:selection_strategy,
                             "Selection strategy with name '#{selection_strategy_name}' needs to be migrated over first.")
          end

          if params_to_use[:query_doc_pairs]
            list_of_emails_of_users = []
            params_to_use[:query_doc_pairs].each do |query_doc_pair|
              next unless query_doc_pair[:judgements]

              query_doc_pair[:judgements].each do |judgement|
                list_of_emails_of_users << judgement[:user_email]
              end
            end
            list_of_emails_of_users.uniq!
            list_of_emails_of_users.each do |email|
              unless User.exists?(email: email)
                @book.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
              end
            end
          end

          unless @book.errors.empty?
            render json: @book.errors, status: :bad_request
            return
          end

          # passed first set of validations.
          @book.name = params_to_use[:name]
          @book.show_rank = params_to_use[:show_rank]
          @book.support_implicit_judgements = params_to_use[:support_implicit_judgements]

          @book.scorer = Scorer.find_by(name: scorer_name)
          @book.selection_strategy = SelectionStrategy.find_by(name: selection_strategy_name)

          params_to_use[:query_doc_pairs]&.each do |query_doc_pair|
            qdp = @book.query_doc_pairs.build(query_doc_pair.except(:judgements))
            next unless query_doc_pair[:judgements]

            query_doc_pair[:judgements].each do |judgement|
              judgement[:user] = User.find_by(email: judgement[:user_email])
              qdp.judgements.build(judgement.except(:user_email))
            end
          end

          if @book.save
            respond_with @book
          else
            render json: @book.errors, status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
        # rubocop:enable Metrics/CyclomaticComplexity
        # rubocop:enable Metrics/PerceivedComplexity
        # rubocop:enable Layout/LineLength

        private

        def book_params
          params.require(:book).permit!
        end
      end
    end
  end
end

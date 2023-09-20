# frozen_string_literal: true

module Api
  module V1
    module Import
      class CasesController < Api::ApiController
        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        def create
          params_to_use = case_params.to_h.deep_symbolize_keys

          @case = Case.new

          @case.owner = current_user

          scorer_name = params_to_use[:scorer][:name]
          unless Scorer.exists?(name: scorer_name)
            @case.errors.add(:scorer, "Scorer with name '#{scorer_name}' needs to be migrated over first.")
          end

          if params_to_use[:queries]
            list_of_emails_of_users = []
            params_to_use[:queries].each do |query|
              next unless query[:ratings]

              query[:ratings].each do |rating|
                list_of_emails_of_users << rating[:user_email]
              end
            end
            list_of_emails_of_users.uniq!
            list_of_emails_of_users.each do |email|
              unless User.exists?(email: email)
                @case.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
              end
            end
          end

          unless @case.errors.empty?
            render json: @case.errors, status: :bad_request
            return
          end

          # passed first set of validations.
          @case.case_name = params_to_use[:case_name]

          @case.scorer = Scorer.find_by(name: scorer_name)

          # For some reason we can't do @case.queries.build with out forcing a save.
          # Works fine with book however.
          unless @case.save
            render json: @case.errors, status: :bad_request
            return
          end

          params_to_use[:queries]&.each do |query|
            new_query = @case.queries.build(query.except(:ratings))
            next unless query[:ratings]

            query[:ratings].each do |rating|
              rating[:user] = User.find_by(email: rating[:user_email])
              new_query.ratings.build(rating.except(:user_email))
            end
          end

          params_to_use[:try][:try_number] = 1

          @case.tries.first.update(params_to_use[:try])

          if @case.save
            respond_with @case
          else
            render json: @case.errors, status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
        # rubocop:enable Metrics/CyclomaticComplexity
        # rubocop:enable Metrics/PerceivedComplexity

        private

        def case_params
          params.require(:case).permit!
        end
      end
    end
  end
end

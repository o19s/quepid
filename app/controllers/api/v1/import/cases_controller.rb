# frozen_string_literal: true

module Api
  module V1
    module Import
      class CasesController < Api::ApiController
        api!
        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        def create
          list_of_emails_of_users = []
          params_to_use = case_params.to_h.deep_symbolize_keys

          @case = Case.new

          list_of_emails_of_users << params_to_use[:owner_email]

          scorer_name = params_to_use[:scorer][:name]
          unless Scorer.exists?(name: scorer_name)
            @case.errors.add(:scorer, "Scorer with name '#{scorer_name}' needs to be migrated over first.")
          end

          params_to_use[:queries]&.each do |query|
            next unless query[:ratings]

            query[:ratings].each do |rating|
              list_of_emails_of_users << rating[:user_email] if rating[:user_email].present?
            end
          end

          list_of_emails_of_users.uniq.each do |email|
            unless User.exists?(email: email)
              @case.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
            end
          end

          unless @case.errors.empty?
            render json: @case.errors, status: :bad_request
            return
          end

          # passed first set of validations.
          @case.case_name = params_to_use[:case_name]
          @case.options = params_to_use[:options]

          @case.scorer = Scorer.find_by(name: scorer_name)

          @case.owner = User.find_by(email: params_to_use[:owner_email])

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
              rating[:user] = User.find_by(email: rating[:user_email]) if rating[:user_email].present?
              new_query.ratings.build(rating.except(:user_email))
            end
          end

          # find_or_create_by wasn't working, so just doing it in two steps
          search_endpoint = @current_user.search_endpoints_involved_with.find_by(
            params_to_use[:try][:search_endpoint]
          )
          if search_endpoint.nil?
            search_endpoint = SearchEndpoint.new(params_to_use[:try][:search_endpoint])
            search_endpoint.owner = @current_user
            search_endpoint.save!
          end

          params_to_use[:try][:search_endpoint_id] = search_endpoint.id
          params_to_use[:try][:try_number] = 1

          @case.tries.first.update(params_to_use[:try].except(:curator_variables, :search_endpoint))

          params_to_use[:try][:curator_variables].each do |curator_variable|
            # not sure why curator_variables.build and then the @case.save doesn't cascade down.
            @case.tries.first.curator_variables.create curator_variable
          end

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

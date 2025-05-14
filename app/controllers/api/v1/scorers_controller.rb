# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
module Api
  module V1
    class ScorersController < Api::ApiController
      before_action :set_scorer, only: [ :show, :update, :destroy ]
      before_action :check_communal_scorers_only, only: [ :create, :update, :destroy ]

      api :GET, '/api/scorers',
          'List all scorers to which the user has access.'
      error :code => 401, :desc => 'Unauthorized'
      def index
        @user_scorers = current_user.scorers_involved_with.all.reject(&:communal?) unless Rails.application.config.communal_scorers_only
        @communal_scorers = Scorer.communal

        respond_with @user_scorers, @communal_scorers
      end

      def show
        respond_with @scorer
      end

      def create
        @scorer = current_user.owned_scorers.build scorer_params

        if @scorer.save
          Analytics::Tracker.track_scorer_created_event current_user, @scorer
          respond_with @scorer
        else
          render json: @scorer.errors, status: :bad_request
        end
      rescue ActiveRecord::SerializationTypeMismatch
        # Get a version of the params without the scale, which is causing
        # the Exception to be raised.
        sanitized_params = scorer_params
        sanitized_params.delete(:scale)
        sanitized_params.delete('scale')

        # Reinitialize the object without the scale, to maintain the
        # passed values, just in case another error should be communicated
        # back to the caller.
        @scorer = current_user.owned_scorers.build sanitized_params
        @scorer.errors.add(:scale, :type)

        render json: @scorer.errors, status: :bad_request
      end

      # rubocop:disable Metrics/MethodLength
      def update
        unless @scorer.owner == current_user || (@scorer.communal && current_user.administrator?)
          render(
            json:   {
              error: 'Cannot edit a scorer you do not own',
            },
            status: :forbidden
          )

          return
        end

        begin
          if @scorer.update scorer_params
            Analytics::Tracker.track_scorer_updated_event current_user, @scorer
            respond_with @scorer
          else
            render json: @scorer.errors, status: :bad_request
          end
        rescue ActiveRecord::SerializationTypeMismatch
          @scorer.reload

          # Get a version of the params without the scale, which is causing
          # the Exception to be raised.
          sanitized_params = scorer_params
          sanitized_params.delete(:scale)
          sanitized_params.delete('scale')

          # Re-update the object without the scale, to maintain the
          # passed values, just in case another error should be communicated
          # back to the caller.
          @scorer.update sanitized_params
          @scorer.errors.add(:scale, :type)

          render json: @scorer.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/MethodLength

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/PerceivedComplexity
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/AbcSize

      # This method lets you delete a scorer, and if you pass in force=true then
      # you update other objects with either the system default scorer, or, if
      # you pass in the replacement_scorer_id then that scorer.
      def destroy
        force = deserialize_bool_param(params[:force])
        if force
          replacement_scorer = params[:replacement_scorer_id].present? ? Scorer.find_by(id: params[:replacement_scorer_id]) : Scorer.system_default_scorer
        end

        @users = User.where(default_scorer_id: @scorer.id)
        if @users.count.positive? && force
          # rubocop:disable Rails/SkipsModelValidations
          @users.update_all(default_scorer_id: replacement_scorer.id)
          # rubocop:enable Rails/SkipsModelValidations
        elsif @users.count.positive?
          render(
            json:   {
              error: "Cannot delete the scorer because it is the default for #{@users.count} #{'user'.pluralize(@users.count)}: [#{@users.take(3).map(&:email).to_sentence}]",
            },
            status: :bad_request
          )

          return
        end

        @cases = Case.where(scorer_id: @scorer.id)
        if @cases.count.positive? && force
          # We can't have a nil scorer on a case, so setting all to the default.  See comment above about how
          # we should really pass in a replacement scorer id!
          @cases.update_all(scorer_id: replacement_scorer.id) # rubocop:disable Rails/SkipsModelValidations
        elsif @cases.count.positive?
          render(
            json:   {
              error: "Cannot delete the scorer because it is the default for #{@cases.count} #{'case'.pluralize(@cases.count)}: #{@cases.take(3).map(&:case_name).to_sentence}",
            },
            status: :bad_request
          )

          return
        end

        @scorer.destroy
        Analytics::Tracker.track_scorer_deleted_event current_user, @scorer

        head :no_content
      end
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity
      # rubocop:enable Metrics/MethodLength

      private

      def scorer_params
        return unless params[:scorer]

        params.expect(
          scorer: [ :code,
                    :name,
                    :show_scale_labels,
                    :communal,
                    { scale:             [],
                      scale_with_labels: {} } ]
        )
      end

      def set_scorer
        # This block of logic should all be in user_scorer_finder.rb
        @scorer = current_user.scorers_involved_with.where(id: params[:id]).first

        @scorer = Scorer.communal.where(id: params[:id]).first if @scorer.nil? # Check if communal scorers has the scorer.  This logic should be in the .scorers. method!

        render json: { error: 'Not Found!' }, status: :not_found unless @scorer
      end

      def check_communal_scorers_only
        return unless Rails.application.config.communal_scorers_only

        render(
          json:   { error: 'Communal Scorers Only!' },
          status: :forbidden
        )
      end
    end
  end
end
# rubocop:enable Metrics/ClassLength

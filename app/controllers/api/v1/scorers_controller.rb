# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
module Api
  module V1
    class ScorersController < Api::ApiController
      before_action :set_scorer, only: %i[show update destroy]

      def index
        @user_scorers      = current_user.scorers.all
        @default_scorers   = DefaultScorer.published
          .order(published_at: :desc)
          .all

        respond_with @user_scorers, @default_scorers
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
        unless @scorer.owner == current_user
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
      def destroy
        unless @scorer.owner == current_user
          render(
            json:   {
              error: 'Cannot delete a scorer you do not own',
            },
            status: :forbidden
          )

          return
        end

        @users = User.where(scorer_id: @scorer.id)
        if @users.count.positive? && params[:force]
          @users.update_all(scorer_id: nil) # rubocop:disable Rails/SkipsModelValidations
        elsif @users.count.positive?
          render(
            json:   {
              # rubocop:disable Metrics/LineLength
              error: "Cannot delete the scorer because it is the default for #{@users.count} #{'user'.pluralize(@users.count)}: [#{@users.take(3).map(&:username).to_sentence}]",
              # rubocop:enable Metrics/LineLength
            },
            status: :bad_request
          )

          return
        end

        @cases = Case.where(scorer_id: @scorer.id)
        if @cases.count.positive? && params[:force]
          @cases.update_all(scorer_id: nil) # rubocop:disable Rails/SkipsModelValidations
        elsif @cases.count.positive?
          render(
            json:   {
              # rubocop:disable Metrics/LineLength
              error: "Cannot delete the scorer because it is the default for #{@cases.count} #{'case'.pluralize(@cases.count)}: [#{@cases.take(3).map(&:case_name).to_sentence}]",
              # rubocop:enable Metrics/LineLength
            },
            status: :bad_request
          )

          return
        end

        @queries = Query.where(scorer_id: @scorer.id)
        if @queries.count.positive? && params[:force]
          @queries.update_all(scorer_id: nil) # rubocop:disable Rails/SkipsModelValidations
        elsif @queries.count.positive?
          render(
            json:   {
              # rubocop:disable Metrics/LineLength
              error: "Cannot delete the scorer because it is the default for #{@queries.count} #{'query'.pluralize(@queries.count)}: [#{@queries.take(3).map(&:query_text).to_sentence}]",
              # rubocop:enable Metrics/LineLength
            },
            status: :bad_request
          )

          return
        end

        @teams = @scorer.teams
        if @teams.count.positive?
          render(
            json:   {
              # rubocop:disable Metrics/LineLength
              error: "Cannot delete the scorer because it is shared with #{@teams.count} #{'team'.pluralize(@teams.count)}: [#{@teams.take(3).map(&:name).to_sentence}]",
              # rubocop:enable Metrics/LineLength
            },
            status: :bad_request
          )

          return
        end

        @scorer.delete
        Analytics::Tracker.track_scorer_deleted_event current_user, @scorer

        render json: {}, status: :no_content
      end
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity
      # rubocop:enable Metrics/MethodLength

      private

      def scorer_params
        return unless params[:scorer]

        params.require(:scorer).permit(
          :code,
          :name,
          :query_test,
          :query_id,
          :manual_max_score,
          :manual_max_score_value,
          :show_scale_labels,
          :scale,
          scale: []
        ).tap do |whitelisted|
          whitelisted[:scale_with_labels] = params[:scorer][:scale_with_labels]
        end
      end

      def set_scorer
        @scorer = current_user.scorers.where(id: params[:id]).first

        render json: { error: 'Not Found!' }, status: :not_found unless @scorer
      end
    end
  end
end
# rubocop:enable Metrics/ClassLength

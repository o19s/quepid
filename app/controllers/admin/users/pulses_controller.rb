# frozen_string_literal: true

module Admin
  module Users
    class PulsesController < Admin::AdminController
      before_action :set_user
      before_action :set_data
      respond_to :json

      def show
        render json: @data
      end

      private

      def set_user
        @user = User.find(params[:user_id])
      end

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      def set_data
        case params[:data]
        when 'metadata'
          @data = CaseMetadatum.where(user_id: @user.id)
            .where('last_viewed_at >= :start AND last_viewed_at <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group(:last_viewed_at)
            .count
        when 'scores'
          @data = Score.where(user_id: @user.id)
            .where('created_at >= :start AND created_at <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group(:created_at)
            .count
        when 'cases-created'
          @data = Case.where(owner_id: @user.id)
            .where('created_at >= :start AND created_at <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group(:created_at)
            .count
        when 'teams-created'
          @data = Team.where(owner_id: @user.id)
            .where('created_at >= :start AND created_at <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group(:created_at)
            .count
        when 'queries-created'
          @data = Query.joins(:case)
            .where(cases: { owner_id: @user.id })
            .where('`queries`.`created_at` >= :start AND `queries`.`created_at` <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group('`queries`.`created_at`')
            .count
        end
        # rubocop:disable Style/HashTransformKeys
        @data = @data.to_h do |k, v|
          [ k.to_i, v ]
        end
        # rubocop:enable Style/HashTransformKeys
      end
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/MethodLength
    end
  end
end

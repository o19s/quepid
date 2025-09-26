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
            .where(last_viewed_at: (params[:start])..(params[:end]))
            .group(:last_viewed_at)
            .count
        when 'scores'
          @data = Score.where(user_id: @user.id)
            .where(created_at: (params[:start])..(params[:end]))
            .group(:created_at)
            .count
        when 'cases-created'
          @data = Case.where(owner_id: @user.id)
            .where(created_at: (params[:start])..(params[:end]))
            .group(:created_at)
            .count
        when 'queries-created'
        # this doesn't handle situation where you create queries for a case that you partipate in but don't own.
          @data = Query.joins(:case)
            .where(cases: { owner_id: @user.id })
            .where('`queries`.`created_at` >= :start AND `queries`.`created_at` <= :end',
                   start: params[:start],
                   end:   params[:end])
            .group('`queries`.`created_at`')
            .count
        when 'books-created'
          @data = current_user.books_involved_with
            .where(created_at: (params[:start])..(params[:end]))
            .group(:created_at)
            .count
        when 'judgments-created'
          @data = current_user.judgements
            .where(created_at: (params[:start])..(params[:end]))
            .group(:created_at)
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

# frozen_string_literal: true

module Connections
  class UsagesController < ApplicationController
    def show
      connection = current_user.connections_involved_with.find_by(id: params[:connection_id])
      return head :not_found unless connection

      @kind = params[:kind]
      scope = case @kind
              when 'embedders' then current_user.embedders_involved_with
              when 'ai_judges' then AiJudge.for_user(current_user)
              else return head :bad_request
              end
      @records = scope.where(connection_id: connection.id).select(:id, :name).order(:name)
      render layout: false
    end
  end
end

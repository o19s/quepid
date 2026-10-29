# frozen_string_literal: true

module Connections
  # Backs the connection form's Check connection button: asks the service something cheap with the
  # *current* form values, saved or not, and reports what came back. Never writes to the database.
  #
  # Without a connection_id the check runs on the unsaved form. With one, a blank secret means
  # "use the saved one" -- but only for someone who can manage that connection: a check sends the
  # secret to whatever URL the form holds, so anyone else could aim it at a server of their own.
  class ChecksController < ApplicationController
    def create
      connection = build_connection
      return head(:not_found) if connection.nil?

      unless connection.valid?
        render json: { error: connection.errors.full_messages.to_sentence }, status: :unprocessable_content
        return
      end

      render json: connection.check.to_h
    end

    private

    def build_connection
      saved = find_saved if params.key?(:connection_id)
      return nil if params.key?(:connection_id) && saved.nil?

      attributes = connection_params
      attributes = attributes.except(:secret) if saved && Connection.keep_existing_secret?(attributes[:secret])

      connection = saved ? saved.dup : Connection.new
      connection.assign_attributes(attributes)
      # Testing before naming it is fine; the name doesn't affect the request.
      connection.name = 'Untitled' if connection.name.blank?
      connection
    end

    def find_saved
      connection = current_user.connections_involved_with.find_by(id: params[:connection_id])
      connection if connection&.manageable_by?(current_user)
    end

    def connection_params
      params.expect(connection: Connection::PERMITTED_PARAMS)
    end
  end
end

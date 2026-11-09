# frozen_string_literal: true

module Connections
  # Backs the status column of the Connections list: asks the *saved* connection something cheap
  # and reports whether it answers, so each row can show a green or red plug. One request per row,
  # so a slow service delays only its own icon.
  #
  # Anyone who can use a connection can ask, unlike the form's check: this one always goes to the
  # connection's own URL with its own key and never takes either from the request, so it can't be
  # aimed anywhere else.
  class StatusesController < ApplicationController
    # A list page shouldn't hold a thread for the connection's whole timeout (up to ten minutes).
    MAX_TIMEOUT = 10

    def show
      connection = current_user.connections_involved_with.find_by(id: params[:connection_id])
      return render(json: { error: 'Connection not found' }, status: :not_found) if connection.nil?

      connection.timeout = [ connection.timeout, MAX_TIMEOUT ].min
      render json: connection.check.to_h
    end
  end
end

# frozen_string_literal: true

module Admin
  class AdminController < ::ApplicationController
    before_action :require_administrator
    layout 'admin'

    private

    def require_administrator
      return true if @current_user.administrator?

      respond_to do |format|
        format.html { redirect_to root_path, notice: 'You must be a Quepid Administrator.' }
        format.json { render json: { error: 'No bueno muchacho!' }, status: :unauthorized }
      end
    end
  end
end

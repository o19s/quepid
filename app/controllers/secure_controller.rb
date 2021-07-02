# frozen_string_literal: true

class SecureController < ApplicationController
  force_ssl if: :ssl_enabled?
  skip_before_action :require_login

  def index
  end
end

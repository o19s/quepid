# frozen_string_literal: true

class SecureController < ApplicationController
  # TODO: don't know what to do with it yet
  #force_ssl if: :ssl_enabled?
  skip_before_action :require_login

  def index
  end
end

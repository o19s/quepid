# frozen_string_literal: true

class HomeController < ApplicationController
  before_action :redirect_to_non_ssl

  def index
    return unless current_user

    # load a case/try if the user has access to one
    bootstrap_case = current_user.cases_involved_with.not_archived.last

    if bootstrap_case
      @bootstrap_case_no  = bootstrap_case.id
      best_try            = bootstrap_case.tries.best
      @bootstrap_try_no   = best_try.try_number if best_try.present?
    end
  end

  private

  def redirect_to_non_ssl
    if request.ssl?
      original_url = request.original_url
      original_url.gsub!(%r{https://}, 'http://')
      redirect_to original_url
      flash.keep
      return false
    end

    true
  end
end

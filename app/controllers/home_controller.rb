# frozen_string_literal: true

class HomeController < ApplicationController
  before_action :redirect_to_non_ssl

  # ignoring naming convention because these are getting passed to JS
  # rubocop:disable Naming/VariableName
  def index
    @triggerWizard = false

    return unless current_user

    # load a case/try if one was set somewhere
    bootstrapCase = current_user.cases_involved_with.not_archived.last

    if bootstrapCase
      @bootstrapCaseNo  = bootstrapCase.id
      best_try          = bootstrapCase.tries.best
      @bootstrapTryNo   = best_try.try_number if best_try.present?
    else
      @triggerWizard    = true unless current_user.first_login?

      bootstrapCase     = current_user.cases.create case_name: "Case #{current_user.cases.size}"
      @bootstrapCaseNo  = bootstrapCase.id
      bootStrapTry      = bootstrapCase.tries.first
      @bootstrapTryNo   = bootStrapTry.try_number
    end
  end
  # rubocop:enable Naming/VariableName

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

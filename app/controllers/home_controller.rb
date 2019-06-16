# frozen_string_literal: true

class HomeController < ApplicationController
  before_action :redirect_to_non_ssl

  # ignoring naming convention because these are getting passed to JS
  # rubocop:disable Naming/VariableName
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def index
    @triggerWizard = false

    if current_user
      # load a case/try if one was set somewhere
      bootstrapCase = nil

      # First check if the case and the try have been set in the session
      @bootstrapCaseNo  = session[:bootstrapCaseNo]
      @bootstrapTryNo   = session[:bootstrapTryNo]

      # Clear the session
      session.delete :bootstrapCaseNo
      session.delete :bootstrapTryNo

      if @bootstrapCaseNo
        # Note, calling `case` not `cases` which fetches cases both owned
        # and shared
        bootstrapCase = current_user.case.where(id: @bootstrapCaseNo).first
      end

      bootstrapCase ||= current_user.case.where.not(archived: true).last

      if bootstrapCase
        @bootstrapCaseNo  = bootstrapCase.id
        best_try          = bootstrapCase.tries.best
        @bootstrapTryNo   = best_try.tryNo if best_try.present?
      else
        @triggerWizard = true unless current_user.firstLogin?

        bootstrapCase     = current_user.cases.create caseName: Case::DEFAULT_NAME
        @bootstrapCaseNo  = bootstrapCase.id
        @bootstrapTryNo   = bootstrapCase.tries.best.tryNo
      end
    end

    @user_decorator = CurrentUserDecorator.new(current_user)
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
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

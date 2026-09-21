# frozen_string_literal: true

module Core
  # Server-rendered case header for the Angular core case page.
  #
  # The header (case name, try name, nightly/public/archived badges, scorer name) is
  # plain Rails model data that `CoreController` already loads, so it is rendered from
  # `@case`/`@try` instead of being interpolated out of the Angular `caseSvc`/`settingsSvc`
  # models. Renames post here and re-render the `case_header` Turbo Frame in place, which
  # is what replaces Angular's digest for this surface.
  #
  # Only the live, client-computed parts of the header (the score badges) stay in Angular.
  class CaseHeaderController < ApplicationController
    before_action :set_case
    before_action :set_try

    def show
      render partial: 'core/case_header', locals: header_locals
    end

    def rename_case
      name = params.expect(case: [ :case_name ])[:case_name].to_s.strip

      if name.present? && @case.update(case_name: name)
        render partial: 'core/case_header', locals: header_locals
      else
        render_rename_error 'Case name cannot be blank.'
      end
    end

    def rename_try
      name = params.expect(try: [ :name ])[:name].to_s.strip

      if name.present? && @try&.update(name: name)
        render partial: 'core/case_header', locals: header_locals
      else
        render_rename_error 'Try name cannot be blank.'
      end
    end

    private

    # `update` assigns before it validates, so a record that failed validation still carries the
    # rejected value in memory. Re-render from what is actually persisted, or the header would
    # show a name the database does not have.
    def render_rename_error message
      @case&.reload
      @try&.reload

      render partial: 'core/case_header',
             locals:  header_locals.merge(error: message),
             status:  :unprocessable_content
    end

    def header_locals
      { kase: @case, a_try: @try, error: nil }
    end

    def set_case
      @case = current_user.cases_involved_with.where(id: params[:id]).first

      render plain: 'Case not found', status: :not_found if @case.nil?
    end

    # `try_number` is optional on #show (the header renders for whichever try the page is
    # displaying) but required on #rename_try, where the route supplies it.
    def set_try
      return if @case.nil?

      @try = if params[:try_number].present?
               @case.tries.where(try_number: params[:try_number]).first
             else
               @case.tries.latest
             end
    end
  end
end

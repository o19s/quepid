# frozen_string_literal: true

module Core
  class ModalCatalogsController < ApplicationController
    before_action :set_case, only: [ :sharing, :books ]

    def sharing
      @teams = current_user.teams.to_a
      @shared_team_ids = @case.teams.where(id: @teams.map(&:id)).pluck(:id)
      render partial: 'shared/share_case_core_team_templates'
    end

    def books
      # The case JSON and team-book APIs expose only teams the user belongs to.
      teams = @case.teams.where(id: current_user.teams.select(:id)).preload(:books)
      @books = (current_user.books.active.to_a + teams.flat_map(&:books)).uniq(&:id)
      render partial: 'core/judgement_book_templates'
    end

    def scorers
      @communal_scorers = Scorer.communal
      @user_scorers = if Rails.application.config.communal_scorers_only
                        []
                      else
                        current_user.scorers_involved_with.reject(&:communal?)
                      end
      render partial: 'core/scorer_list_template'
    end
  end
end

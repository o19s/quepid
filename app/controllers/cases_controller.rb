# frozen_string_literal: true

class CasesController < ApplicationController
  include Pagy::Method

  before_action :set_case, only: [ :archive, :unarchive ]

  def index
    @archived = deserialize_bool_param(params[:archived])
    @filter_q = params[:q].to_s.strip
    @filter_team_id = params[:team_id].to_s.strip

    # Get all cases the user is involved with (owned or via teams)
    query = current_user.cases_involved_with

    # Apply team filter
    query = query.joins(:teams).where(teams: { id: @filter_team_id }) if @filter_team_id.present?

    # Apply search filter
    if @filter_q.present?
      query = query.where('case_name LIKE ? OR cases.id = ?',
                          "%#{@filter_q}%", @filter_q.to_i)
    end

    # Apply archived filter
    query = query.where(archived: @archived)

    # Include associations and counts for efficient loading
    query = query.with_counts
    # query = query.includes([ :metadata ])
    # query = query.order('`case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC')
    query = query.includes(:owner, :teams, scores: :user).distinct

    # Paginate results
    @pagy, @cases = pagy(query)

    # Get user's teams for the share modal
    @user_teams = current_user.teams.order(:name)
  end

  # Archive a case (mark archived and set current_user as owner)
  def archive
    unless @case
      flash[:alert] = 'Case not found.'
      redirect_to cases_path and return
    end

    @case.owner = current_user
    @case.mark_archived!
    Analytics::Tracker.track_case_archived_event(current_user, @case) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_archived_event)
    flash[:notice] = "Case ##{@case.case_name} archived."

    redirect_to cases_path
  end

  # Unarchive a case
  def unarchive
    unless @case
      flash[:alert] = 'Case not found.'
      redirect_to cases_path and return
    end

    @case.archived = false
    @case.save
    flash[:notice] = "Case ##{@case.case_name} unarchived."

    redirect_to cases_path
  end

  private

  def set_case
    @case = Case.find_by(id: params[:id])
  end
end

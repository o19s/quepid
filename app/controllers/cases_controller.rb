# frozen_string_literal: true

class CasesController < ApplicationController
  include Pagy::Method

  before_action :set_case, only: [ :archive, :unarchive, :destroy, :destroy_queries ]

  def index
    @archived = deserialize_bool_param(params[:archived])
    @filter_q = params[:search].to_s.strip
    @filter_team_id = params[:team_id].to_s.strip

    @q = current_user.cases_involved_with.ransack(cases_ransack_params)
    query = @q.result

    # Collapse any duplicates the team join produced by matching on ids, then
    # build the query we actually render from a clean scope. Selecting DISTINCT
    # over every column would ask the database to compare whole `cases` rows,
    # including a json options column.
    query = Case.where(id: query.reselect(:id).distinct)

    # Include associations and counts for efficient loading
    query = query.with_counts
    # query = query.includes([ :metadata ])
    # query = query.order('`case_metadata`.`last_viewed_at` DESC, `cases`.`id` DESC')
    query = query.includes(:owner, :teams)

    # Default sort until the user clicks a column header (sort_link in the
    # view drives @q.sorts from here on) - applied after the dedup/dedup-via-
    # Case.where above, since @q.result's own order doesn't survive that.
    query = query.order(@q.sorts.any? ? @q.sorts.map(&:name).zip(@q.sorts.map(&:dir)).to_h : { updated_at: :desc })

    # Paginate results
    @pagy, @cases = pagy(query)
    @last_scores = Score.latest_summaries_for_cases(@cases.map(&:id)).index_by(&:case_id)

    # Get user's teams for the share modal
    @user_teams = current_user.teams.order(:name)
  end

  # Archive a case (mark archived and set current_user as owner)
  def archive
    @case.owner = current_user
    @case.mark_archived!
    Analytics::Tracker.track_case_archived_event(current_user, @case) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_archived_event)
    flash[:notice] = "Case #{@case.case_name} archived."

    redirect_to cases_path
  end

  # Unarchive a case
  def unarchive
    @case.archived = false
    @case.save
    flash[:notice] = "Case #{@case.case_name} unarchived."

    redirect_to cases_path
  end

  # Permanently delete a case
  def destroy
    case_name = @case.case_name
    @case.really_destroy
    Analytics::Tracker.track_case_deleted_event(current_user, @case) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_deleted_event)
    flash[:notice] = "Case #{case_name} deleted."

    redirect_to cases_path
  end

  # Delete all queries (and their ratings) for a case
  def destroy_queries
    @case.queries.destroy_all
    flash[:notice] = "All queries deleted for case #{@case.case_name}."

    redirect_to case_core_path(id: @case.id, try_number: @case.last_try_number)
  end

  private

  # params[:q] only ever carries sort state here (q[s]=... from sort_link) -
  # the free-text box is params[:search], kept separate since it isn't a
  # single groupable Ransack attribute. archived stays a top-level AND'd
  # condition; the name-or-id search is a nested OR grouping (Ransack ANDs
  # top-level conditions with named groupings by default, only ORing
  # *within* a grouping).
  def cases_ransack_params
    ransack_params = params[:q].present? ? params[:q].to_unsafe_h : {}
    ransack_params[:archived_eq] = @archived
    ransack_params[:teams_id_eq] = @filter_team_id if @filter_team_id.present?
    ransack_params[:groupings] = { search: { m: 'or', case_name_cont: @filter_q, id_eq: @filter_q.to_i } } if @filter_q.present?
    ransack_params
  end

  def set_case
    @case = current_user.cases_involved_with.find_by(id: params[:id])

    return if @case

    flash[:alert] = 'Case not found.'
    redirect_to cases_path
  end
end

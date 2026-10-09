# frozen_string_literal: true

class TeamsController < ApplicationController
  include Pagy::Method

  rescue_from ActiveRecord::RecordNotFound do |exception|
    resource_name = exception.model.underscore.humanize
    flash[:alert] = "#{resource_name} not found."
    redirect_to teams_path, status: :see_other
  end

  before_action :set_team, only: [ :show, :add_member, :remove_member, :rename, :remove_case, :archive_case, :unarchive_case, :archive_search_endpoint, :unarchive_search_endpoint, :suggest_members ]

  # Remove a case from the team
  def remove_case
    kase = Case.find(params.expect(:case_id))

    if @team.cases.exists?(kase.id)
      @team.cases.delete(kase)
      flash[:notice] = "Case #{kase.case_name} removed from the team."
      Analytics::Tracker.track_case_deleted_event(current_user, kase)
    else
      flash[:alert] = "Case #{kase.case_name} is not associated with this team."
    end

    redirect_to team_path(@team), status: :see_other
  end

  def share_case
    team = current_user.teams.find(params.expect(:team_id))
    record = Case.find(params.expect(:case_id))
    share_with_team(record, record.case_name, team)
  end

  def unshare_case
    team = current_user.teams.find(params.expect(:team_id))
    record = Case.find(params.expect(:case_id))
    unshare_with_team(record, record.case_name, team)
  end

  def share_book
    team = current_user.teams.find(params.expect(:team_id))
    record = Book.find(params.expect(:book_id))
    share_with_team(record, record.name, team)
  end

  def unshare_book
    team = current_user.teams.find(params.expect(:team_id))
    record = Book.find(params.expect(:book_id))
    unshare_with_team(record, record.name, team)
  end

  def share_search_endpoint
    team = current_user.teams.find(params.expect(:team_id))
    record = SearchEndpoint.find(params.expect(:search_endpoint_id))
    share_with_team(record, record.fullname, team)
  end

  def unshare_search_endpoint
    team = current_user.teams.find(params.expect(:team_id))
    record = SearchEndpoint.find(params.expect(:search_endpoint_id))
    unshare_with_team(record, record.fullname, team)
  end

  # Archive a search endpoint
  def archive_search_endpoint
    search_endpoint = SearchEndpoint.find(params.expect(:search_endpoint_id))

    # Only archive if the search endpoint is associated with this team
    if @team.search_endpoints.exists?(search_endpoint.id)
      search_endpoint.owner = current_user
      search_endpoint.mark_archived!
      flash[:notice] = "Search endpoint #{search_endpoint.fullname} archived."
    else
      flash[:alert] = "Search endpoint #{search_endpoint.fullname} is not associated with this team."
    end

    redirect_to team_path(@team), status: :see_other
  end

  # Unarchive a search endpoint
  def unarchive_search_endpoint
    search_endpoint = SearchEndpoint.find(params.expect(:search_endpoint_id))

    # Only unarchive if the search endpoint is associated with this team
    if @team.search_endpoints.exists?(search_endpoint.id)
      search_endpoint.archived = false
      search_endpoint.save
      flash[:notice] = "Search endpoint #{search_endpoint.fullname} unarchived."
    else
      flash[:alert] = "Search endpoint #{search_endpoint.fullname} is not associated with this team."
    end

    redirect_to team_path(@team), status: :see_other
  end

  # Archive a case (mark archived and set current_user as owner)
  def archive_case
    kase = Case.find(params.expect(:case_id))

    # Only archive if the case is associated with this team
    if @team.cases.exists?(kase.id)
      kase.owner = current_user
      kase.mark_archived!
      Analytics::Tracker.track_case_archived_event(current_user, kase)
      flash[:notice] = "Case #{kase.case_name} archived."
    else
      flash[:alert] = "Case #{kase.case_name} is not associated with this team."
    end

    redirect_to team_path(@team), status: :see_other
  end

  # Unarchive a case
  def unarchive_case
    kase = Case.find(params.expect(:case_id))

    # Only unarchive if the case is associated with this team
    if @team.cases.exists?(kase.id)
      kase.archived = false
      kase.save
      flash[:notice] = "Case #{kase.case_name} unarchived."
    else
      flash[:alert] = "Case #{kase.case_name} is not associated with this team."
    end

    redirect_to team_path(@team), status: :see_other
  end

  def index
    query = current_user.teams

    query = query.joins(:members).where(users: { id: current_user.id }).distinct if params[:member].present?

    query = query.search_by(params[:q], :name) if params[:q].present?

    @pagy, @teams = pagy(query.order(:name))
  end

  # rubocop:disable Metrics/AbcSize
  def show
    @cases_q = params[:cases_q].to_s.strip
    @cases_archived = deserialize_bool_param(params[:cases_archived])

    @members = @team.members.order(:name)
    @cases_count = @team.cases.count
    @books_count = @team.books.count
    @scorers_count = @team.scorers.count
    @search_endpoints_count = @team.search_endpoints.count
    @user_teams = current_user.teams.order(:name)

    # Cases filtering
    cases_query = @team.cases
    cases_query = cases_query.search_by(@cases_q, :case_name).or(cases_query.where(id: @cases_q.to_i)) if @cases_q.present?
    cases_query = @cases_archived ? cases_query.archived : cases_query.active
    @pagy_cases, @cases = pagy(cases_query.order(:id).includes(:owner, :teams))
    @last_scores = Score.latest_summaries_for_cases(@cases.map(&:id)).index_by(&:case_id)

    # Books filtering
    @books_q = params[:books_q].to_s.strip
    @books_archived = deserialize_bool_param(params[:books_archived])

    books_query = @team.books
    books_query = @books_archived ? books_query.archived : books_query.active
    books_query = books_query.with_counts if books_query.respond_to?(:with_counts)
    books_query = books_query.search_by(@books_q, :name) if @books_q.present?

    @pagy_books, @books = pagy(books_query.order(:id))

    # Scorers filtering
    @scorers_q = params[:scorers_q].to_s.strip
    scorers_query = @team.scorers
    scorers_query = scorers_query.search_by(@scorers_q, :name) if @scorers_q.present?
    @pagy_scorers, @scorers = pagy(scorers_query.order(:name), page_param: :scorers_page)

    # Search Endpoints filtering
    @search_endpoints_q = params[:search_endpoints_q].to_s.strip
    @search_endpoints_archived = deserialize_bool_param(params[:search_endpoints_archived])

    search_endpoints_query = @team.search_endpoints.includes(:teams)
    search_endpoints_query = @search_endpoints_archived ? search_endpoints_query.where(archived: true) : search_endpoints_query.not_archived
    search_endpoints_query = search_endpoints_query.search_by(@search_endpoints_q, :name, :endpoint_url) if @search_endpoints_q.present?
    @pagy_search_endpoints, @search_endpoints = pagy(search_endpoints_query.order(:id), page_param: :search_endpoints_page)
  end

  # rubocop:enable Metrics/AbcSize
  def new
    @team = Team.new
  end

  def create
    @team = Team.new(team_params)
    if @team.save
      @team.members << current_user
      redirect_to team_path(@team), notice: 'Team created.', status: :see_other
    else
      render :new, status: :unprocessable_content
    end
  end

  # Looks up an existing user by email and adds to the team if found.
  # rubocop:disable-next Metrics/AbcSize
  def add_member
    email = params[:email].to_s.strip.downcase
    user = User.by_email(email).first
    membership = TeamMembership.new(current_user, @team)

    if user
      if membership.add(user)
        flash[:notice] = "#{user.fullname} added to the team."
      else
        flash[:alert] = "#{user.fullname} is already a member of this team."
      end
      redirect_to team_path(@team), status: :see_other and return
    end

    # If the user wasn't found, try to invite them (if signups are enabled)
    unless signup_enabled?
      flash[:alert] = "No user found with email #{email}. Signups are disabled so cannot invite."
      redirect_to team_path(@team), status: :see_other and return
    end

    # Create an invited user (Devise Invitable) and add to team
    begin
      member = membership.invite(email)

      if membership.add_and_save(member)
        flash[:notice] = membership.invitation_message(member)
      else
        flash[:alert] = member.errors.full_messages.to_sentence
      end

      redirect_to team_path(@team), status: :see_other
    rescue ActiveRecord::RecordInvalid => e
      flash[:alert] = "Unable to add member: #{e.record.errors.full_messages.to_sentence}"
      redirect_to team_path(@team), status: :see_other
    end
  end

  # Rename the team (server-side form).
  def rename
    if @team.update(team_params)
      flash[:notice] = 'Team renamed.'
    else
      flash[:alert] = @team.errors.full_messages.to_sentence
    end

    redirect_to team_path(@team), status: :see_other
  end

  def remove_member
    member = User.find(params.expect(:member_id))

    if TeamMembership.new(current_user, @team).remove(member)
      flash[:notice] = "#{member.fullname} removed from the team."
    else
      flash[:alert] = "#{member.fullname} is not a member of this team."
    end

    destination = @team.members.exists?(current_user.id) ? team_path(@team) : teams_path
    redirect_to destination, status: :see_other
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def suggest_members
    total_start = Time.current
    query = params[:query].to_s.strip.downcase

    return render json: [] if query.blank?

    # Get users from teams the current user is in
    setup_start = Time.current
    team_member_ids = current_user.teams.joins(:members).pluck('members_teams.member_id').uniq

    # Get current user's email domain
    current_domain = current_user.email.split('@').last
    setup_time = ((Time.current - setup_start) * 1000).round(2)

    # Query 1: Exact email match (highest priority)
    # When user provides complete email, bypass security filters to find anyone
    query1_start = Time.current
    exact_email_matches = User
      .where.not(id: @team.members.pluck(:id))
      .by_email(query)
      .limit(10)
    exact_count = exact_email_matches.to_a.count
    query1_time = ((Time.current - query1_start) * 1000).round(2)

    # Base scope: users who are either in teams with current user OR have same email domain
    # Used for prefix and name matching (more restricted)
    scope_start = Time.current
    base_scope = User.where.not(id: @team.members.pluck(:id))
      .where('id IN (?) OR LOWER(email) LIKE ?', team_member_ids, "%@#{current_domain.to_s.downcase}")
    scope_time = ((Time.current - scope_start) * 1000).round(2)

    # Query 2: Prefix email match (exclude exact matches)
    # Matches email prefix for users in teams OR same domain
    # e.g., "kat" matches "kat@o19s.com" and "kat@aol.com" (if in shared team)
    query2_start = Time.current
    prefix_email_matches = base_scope
      .where('LOWER(email) LIKE ?', "#{query}%")
      .where.not(id: exact_email_matches.pluck(:id))
      .limit(10)
    prefix_count = prefix_email_matches.to_a.count
    query2_time = ((Time.current - query2_start) * 1000).round(2)

    # Query 3: Name substring match (exclude email matches)
    query3_start = Time.current
    excluded_ids = (exact_email_matches.pluck(:id) + prefix_email_matches.pluck(:id))
    name_matches = base_scope
      .where('LOWER(name) LIKE ?', "%#{query}%")
      .where.not(id: excluded_ids)
      .limit(10)
    name_count = name_matches.to_a.count
    query3_time = ((Time.current - query3_start) * 1000).round(2)

    # Combine results: exact email, then prefix email, then name matches
    combine_start = Time.current
    all_matches = (exact_email_matches.to_a + prefix_email_matches.to_a + name_matches.to_a).take(10)
    combine_time = ((Time.current - combine_start) * 1000).round(2)

    map_start = Time.current
    suggested_users = all_matches.map do |user|
      # Determine match type based on which query found the user
      matched_on = if exact_email_matches.include?(user) || prefix_email_matches.include?(user)
                     'email'
                   else
                     'name'
                   end

      {
        email:        user.email,
        name:         user.name,
        display_name: user.display_name,
        avatar_url:   user.avatar_url(:small),
        matched_on:   matched_on,
      }
    end
    map_time = ((Time.current - map_start) * 1000).round(2)

    total_time = ((Time.current - total_start) * 1000).round(2)

    # Log performance metrics
    Rails.logger.info '=== Team Member Autocomplete Performance ==='
    Rails.logger.info "Query: '#{query}'"
    Rails.logger.info "Setup time: #{setup_time}ms"
    Rails.logger.info "Query 1 (exact email): #{query1_time}ms (#{exact_count} results)"
    Rails.logger.info "Base scope build: #{scope_time}ms"
    Rails.logger.info "Query 2 (prefix email): #{query2_time}ms (#{prefix_count} results)"
    Rails.logger.info "Query 3 (name match): #{query3_time}ms (#{name_count} results)"
    Rails.logger.info "Combine results: #{combine_time}ms"
    Rails.logger.info "Map to JSON: #{map_time}ms"
    Rails.logger.info "Total time: #{total_time}ms"
    Rails.logger.info "Total results: #{suggested_users.count}"
    Rails.logger.info '==========================================='

    # Add performance timing to response header for easy browser profiling
    response.headers['X-Performance-Timing'] = "total=#{total_time}ms, q1=#{query1_time}ms, q2=#{query2_time}ms, q3=#{query3_time}ms"

    render json: suggested_users
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  private

  def share_with_team record, name, team
    if TeamSharing.new(current_user, team).share(record)
      flash[:notice] = "#{name} shared with #{team.name}."
    else
      flash[:alert] = "#{name} is already shared with #{team.name}."
    end
    redirect_back_or_to(teams_path, status: :see_other)
  rescue TeamSharing::AccessDenied
    sharing_access_denied(record)
  end

  def unshare_with_team record, name, team
    if TeamSharing.new(current_user, team).unshare(record)
      flash[:notice] = "#{name} unshared from #{team.name}."
    else
      flash[:alert] = "#{name} is not shared with #{team.name}."
    end
    redirect_back_or_to(teams_path, status: :see_other)
  rescue TeamSharing::AccessDenied
    sharing_access_denied(record)
  end

  def sharing_access_denied record
    flash[:alert] = "You do not have access to that #{record.class.model_name.human.downcase}."
    redirect_back_or_to(teams_path)
  end

  def set_team
    @team = current_user.teams.find(params.expect(:id))
  end

  def team_params
    params.expect(team: [ :name ])
  end
end

# frozen_string_literal: true

class Teams2Controller < ApplicationController
  include Pagy::Method

  before_action :set_team, only: [ :show, :add_member, :remove_member, :rename, :remove_case, :archive_case, :unarchive_case, :archive_search_endpoint, :unarchive_search_endpoint ]

  # Remove a case from the team
  def remove_case
    kase = Case.find_by(id: params[:case_id])
    unless kase
      flash[:alert] = 'Case not found.'
      redirect_to team2_path(@team) and return
    end

    if @team.cases.exists?(kase.id)
      @team.cases.delete(kase)
      flash[:notice] = "Case ##{kase.case_name} removed from the team."
      Analytics::Tracker.track_case_deleted_event(current_user, kase) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_deleted_event)
    else
      flash[:alert] = "Case ##{kase.case_name} is not associated with this team."
    end

    redirect_to team2_path(@team)
  end

  # Share a case with a team (similar to scorer sharing pattern)
  def share_case
    team = current_user.teams.find_by(id: params[:team_id])
    kase = Case.find_by(id: params[:case_id])

    unless team && kase
      flash[:alert] = 'Team or case not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this case
    unless current_user.cases_involved_with.exists?(id: kase.id)
      flash[:alert] = 'You do not have access to that case.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.cases.exists?(kase.id)
      flash[:alert] = "#{kase.case_name} is already shared with #{team.name}."
    else
      team.cases << kase
      flash[:notice] = "#{kase.case_name} shared with #{team.name}."
      Analytics::Tracker.track_case_shared_event(current_user, kase, team) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_shared_event)
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  def unshare_case
    team = current_user.teams.find_by(id: params[:team_id])
    kase = Case.find_by(id: params[:case_id])

    unless team && kase
      flash[:alert] = 'Team or case not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this case
    unless current_user.cases_involved_with.exists?(id: kase.id)
      flash[:alert] = 'You do not have access to that case.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.cases.exists?(kase.id)
      team.cases.delete(kase)
      flash[:notice] = "#{kase.case_name} unshared from #{team.name}."
    else
      flash[:alert] = "#{kase.case_name} is not shared with #{team.name}."
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  # Share a book with a team (similar to case sharing pattern)
  def share_book
    team = current_user.teams.find_by(id: params[:team_id])
    book = Book.find_by(id: params[:book_id])

    unless team && book
      flash[:alert] = 'Team or book not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this book (owner or team member with access)
    unless current_user.books_involved_with.exists?(id: book.id)
      flash[:alert] = 'You do not have access to that book.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.books.exists?(book.id)
      flash[:alert] = "#{book.name} is already shared with #{team.name}."
    else
      team.books << book
      flash[:notice] = "#{book.name} shared with #{team.name}."
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  def unshare_book
    team = current_user.teams.find_by(id: params[:team_id])
    book = Book.find_by(id: params[:book_id])

    unless team && book
      flash[:alert] = 'Team or book not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this book
    unless current_user.books_involved_with.exists?(id: book.id)
      flash[:alert] = 'You do not have access to that book.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.books.exists?(book.id)
      team.books.delete(book)
      flash[:notice] = "#{book.name} unshared from #{team.name}."
    else
      flash[:alert] = "#{book.name} is not shared with #{team.name}."
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  # Share a search endpoint with a team (similar to case/book sharing pattern)
  def share_search_endpoint
    team = current_user.teams.find_by(id: params[:team_id])
    search_endpoint = SearchEndpoint.find_by(id: params[:search_endpoint_id])

    unless team && search_endpoint
      flash[:alert] = 'Team or search endpoint not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this search endpoint
    unless current_user.search_endpoints_involved_with.exists?(id: search_endpoint.id)
      flash[:alert] = 'You do not have access to that search endpoint.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.search_endpoints.exists?(search_endpoint.id)
      flash[:alert] = "#{search_endpoint.fullname} is already shared with #{team.name}."
    else
      team.search_endpoints << search_endpoint
      flash[:notice] = "#{search_endpoint.fullname} shared with #{team.name}."
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  def unshare_search_endpoint
    team = current_user.teams.find_by(id: params[:team_id])
    search_endpoint = SearchEndpoint.find_by(id: params[:search_endpoint_id])

    unless team && search_endpoint
      flash[:alert] = 'Team or search endpoint not found.'
      redirect_back_or_to(teams2_path) and return
    end

    # Check if user has access to this search endpoint
    unless current_user.search_endpoints_involved_with.exists?(id: search_endpoint.id)
      flash[:alert] = 'You do not have access to that search endpoint.'
      redirect_back_or_to(teams2_path) and return
    end

    if team.search_endpoints.exists?(search_endpoint.id)
      team.search_endpoints.delete(search_endpoint)
      flash[:notice] = "#{search_endpoint.fullname} unshared from #{team.name}."
    else
      flash[:alert] = "#{search_endpoint.fullname} is not shared with #{team.name}."
    end

    redirect_back_or_to(teams2_path, status: :see_other)
  end

  # Archive a search endpoint
  def archive_search_endpoint
    search_endpoint = SearchEndpoint.find_by(id: params[:search_endpoint_id])
    unless search_endpoint
      flash[:alert] = 'Search endpoint not found.'
      redirect_to team2_path(@team) and return
    end

    # Only archive if the search endpoint is associated with this team
    if @team.search_endpoints.exists?(search_endpoint.id)
      search_endpoint.owner = current_user
      search_endpoint.mark_archived!
      flash[:notice] = "Search endpoint #{search_endpoint.fullname} archived."
    else
      flash[:alert] = "Search endpoint #{search_endpoint.fullname} is not associated with this team."
    end

    redirect_to team2_path(@team)
  end

  # Unarchive a search endpoint
  def unarchive_search_endpoint
    search_endpoint = SearchEndpoint.find_by(id: params[:search_endpoint_id])
    unless search_endpoint
      flash[:alert] = 'Search endpoint not found.'
      redirect_to team2_path(@team) and return
    end

    # Only unarchive if the search endpoint is associated with this team
    if @team.search_endpoints.exists?(search_endpoint.id)
      search_endpoint.archived = false
      search_endpoint.save
      flash[:notice] = "Search endpoint #{search_endpoint.fullname} unarchived."
    else
      flash[:alert] = "Search endpoint #{search_endpoint.fullname} is not associated with this team."
    end

    redirect_to team2_path(@team)
  end

  # Archive a case (mark archived and set current_user as owner)
  def archive_case
    kase = Case.find_by(id: params[:case_id])
    unless kase
      flash[:alert] = 'Case not found.'
      redirect_to team2_path(@team) and return
    end

    # Only archive if the case is associated with this team
    if @team.cases.exists?(kase.id)
      kase.owner = current_user
      kase.mark_archived!
      Analytics::Tracker.track_case_archived_event(current_user, kase) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_archived_event)
      flash[:notice] = "Case ##{kase.case_name} archived."
    else
      flash[:alert] = "Case ##{kase.case_name} is not associated with this team."
    end

    redirect_to team2_path(@team)
  end

  # Unarchive a case
  def unarchive_case
    kase = Case.find_by(id: params[:case_id])
    unless kase
      flash[:alert] = 'Case not found.'
      redirect_to team2_path(@team) and return
    end

    # Only unarchive if the case is associated with this team
    if @team.cases.exists?(kase.id)
      kase.archived = false
      kase.save
      flash[:notice] = "Case ##{kase.case_name} unarchived."
    else
      flash[:alert] = "Case ##{kase.case_name} is not associated with this team."
    end

    redirect_to team2_path(@team)
  end

  def index
    @q = params[:q]

    query = Team.all
    query = query.where('name LIKE ?', "%#{@q}%") if @q.present?

    @pagy, @teams = pagy(query.order(:name))
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def show
    @archived = deserialize_bool_param(params[:archived])
    @filter_q = params[:q].to_s.strip

    @members = @team.members.order(:name)
    @cases_count = @team.cases.count
    @books_count = @team.books.count
    @scorers_count = @team.scorers.count
    @search_endpoints_count = @team.search_endpoints.count
    @user_teams = current_user.teams.order(:name)

    query = @team.cases
    # Books filtering (separate params to avoid collision with case filters)
    books_q = params[:books_q].to_s.strip
    books_include_archived = params[:books_archived].present? && params[:books_archived].to_s.in?(%w[1 true on])

    if params[:q].present?
      query = query.where('case_name LIKE ? OR case_id LIKE ? ',
                          "%#{params[:q]}%", "%#{params[:q]}%")
    end
    query = query.where(archived: @archived)
    @cases = query.order(:id).includes(:owner, :teams)

    books_query = @team.books
    books_query = books_include_archived ? books_query.archived : books_query.active
    books_query = books_query.with_counts if books_query.respond_to?(:with_counts)
    books_query = books_query.where('name LIKE ?', "%#{books_q}%") if books_q.present?

    @pagy_books, @books = pagy(books_query.order(:id))
    @filter_books_q = books_q
    @filter_books_archived = books_include_archived

    # Scorers filtering
    scorers_q = params[:scorers_q].to_s.strip
    scorers_query = @team.scorers
    scorers_query = scorers_query.where('name LIKE ?', "%#{scorers_q}%") if scorers_q.present?
    @pagy_scorers, @scorers = pagy(scorers_query.order(:name), page_param: :scorers_page)
    @filter_scorers_q = scorers_q

    # Search Endpoints filtering
    search_endpoints_q = params[:search_endpoints_q].to_s.strip
    search_endpoints_include_archived = params[:search_endpoints_archived].present? && params[:search_endpoints_archived].to_s.in?(%w[1 true on])

    search_endpoints_query = @team.search_endpoints.includes(:teams)
    search_endpoints_query = search_endpoints_include_archived ? search_endpoints_query.where(archived: true) : search_endpoints_query.not_archived
    if search_endpoints_q.present?
      search_endpoints_query = search_endpoints_query.where('name LIKE ? OR endpoint_url LIKE ?',
                                                            "%#{search_endpoints_q}%",
                                                            "%#{search_endpoints_q}%")
    end
    @pagy_search_endpoints, @search_endpoints = pagy(search_endpoints_query.order(:id), page_param: :search_endpoints_page)
    @filter_search_endpoints_q = search_endpoints_q
    @filter_search_endpoints_archived = search_endpoints_include_archived
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  def new
    @team = Team.new
  end

  def create
    @team = Team.new(team_params)
    if @team.save
      redirect_to team2_path(@team), notice: 'Team created.'
    else
      render :new
    end
  end

  # Looks up an existing user by email and adds to the team if found.
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def add_member
    email = params[:email].to_s.strip.downcase
    user = User.where(email: email).first

    if user
      if @team.members.exists?(user.id)
        flash[:alert] = "#{user.fullname} is already a member of this team."
      else
        @team.members << user
        flash[:notice] = "#{user.fullname} added to the team."
        Analytics::Tracker.track_member_added_to_team_event(current_user, @team, user) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_member_added_to_team_event)
      end
      redirect_to team2_path(@team) and return
    end

    # If the user wasn't found, try to invite them (if signups are enabled)
    unless signup_enabled?
      flash[:alert] = "No user found with email #{email}. Signups are disabled so cannot invite."
      redirect_to team2_path(@team) and return
    end

    # Create an invited user (Devise Invitable) and add to team
    member = User.invite!({ email: email, password: '' }, current_user) do |u|
      # If email delivery isn't configured, mark skip_invitation so no email attempt is made
      u.skip_invitation = Rails.application.config.action_mailer.delivery_method.blank?
    end

    @team.members << member unless @team.members.exists?(member.id)

    if @team.save
      Analytics::Tracker.track_member_added_to_team_event(current_user, @team, member) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_member_added_to_team_event)
      message = member.skip_invitation.present? ? "Please share the invite link with #{member.email} directly so they can join." : "Invitation email was sent to #{member.email}"
      flash[:notice] = message
    else
      flash[:alert] = member.errors.full_messages.to_sentence
    end

    redirect_to team2_path(@team)
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity

  # Rename the team (server-side form).
  def rename
    if @team.update(team_params)
      flash[:notice] = 'Team renamed.'
    else
      flash[:alert] = @team.errors.full_messages.to_sentence
    end

    redirect_to team2_path(@team)
  end

  def remove_member
    member = User.find_by(id: params[:member_id])
    unless member
      flash[:alert] = 'User not found.'
      redirect_to team2_path(@team) and return
    end

    if @team.members.exists?(member.id)
      @team.members.delete(member)
      flash[:notice] = "#{member.fullname} removed from the team."
      Analytics::Tracker.track_member_removed_from_team_event(current_user, @team, member)

    else
      flash[:alert] = "#{member.fullname} is not a member of this team."
    end

    redirect_to team2_path(@team)
  end

  private

  def set_team
    @team = Team.find(params[:id])
  end

  def team_params
    params.expect(team: [ :name ])
  end
end

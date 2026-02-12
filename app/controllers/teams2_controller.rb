# frozen_string_literal: true

class Teams2Controller < ApplicationController
  include Pagy::Method

  before_action :set_team, only: [ :show, :add_member, :remove_member, :rename, :remove_case, :archive_case, :share_case, :cases_fragment, :books_fragment ]

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

  # Share a case with another team (non-API flow). This action will create the
  # association and redirect back to the team page (so UX stays on server-side).
  def share_case
    kase = Case.find_by(id: params[:case_id])
    unless kase
      flash[:alert] = 'Case not found.'
      redirect_to team2_path(@team) and return
    end

    if @team.cases.exists?(kase.id)
      flash[:alert] = "Case ##{kase.case_name} is already associated with this team."
    else
      @team.cases << kase
      flash[:notice] = "Case #{kase.case_name} shared with team #{@team.name}."
      Analytics::Tracker.track_case_shared_event(current_user, @team, kase) if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_case_shared_event)
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

  def index
    @q = params[:q]

    query = Team.all
    query = query.where('name LIKE ?', "%#{@q}%") if @q.present?

    @pagy, @teams = pagy(query.order(:name))
  end

  def show
    @archived = deserialize_bool_param(params[:archived])
    @filter_q = params[:q].to_s.strip

    @members = @team.members.order(:name)
    @cases_count = @team.cases.count
    @books_count = @team.books.count
    @scorers_count = @team.scorers.count
    @search_endpoints_count = @team.search_endpoints.count

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

    # If this is a turbo-frame request for one of the frames, return only that partial
    if turbo_frame_request?
      frame = request.headers['Turbo-Frame']
      case frame
      when 'team_cases'
        render partial: 'teams2/cases' and return
      when 'team_books'
        render partial: 'teams2/books' and return
      end
    end
  end

  # Fragment endpoint for lazy-loading the Cases partial inside a turbo-frame.
  def cases_fragment
    @archived = deserialize_bool_param(params[:archived])
    @filter_q = params[:q].to_s.strip

    query = @team.cases
    if params[:q].present?
      query = query.where('case_name LIKE ? OR case_id LIKE ? ',
                          "%#{params[:q]}%", "%#{params[:q]}%")
    end
    query = query.where(archived: @archived)
    @cases = query.order(:id).includes(:owner, :teams)

    # Render a turbo-frame-wrapped template so Turbo can match the frame id
    render template: 'teams2/cases_fragment', layout: false
  end

  # Fragment endpoint for lazy-loading the Books partial inside a turbo-frame.
  def books_fragment
    sleep 3
    books_q = params[:books_q].to_s.strip
    books_include_archived = params[:books_archived].present? && params[:books_archived].to_s.in?(%w[1 true on])

    books_query = @team.books
    books_query = books_include_archived ? books_query.archived : books_query.active
    books_query = books_query.with_counts if books_query.respond_to?(:with_counts)
    books_query = books_query.where('name LIKE ?', "%#{books_q}%") if books_q.present?

    @pagy_books, @books = pagy(books_query.order(:id))
    @filter_books_q = books_q
    @filter_books_archived = books_include_archived

    # Preserve case filters when rendering books fragment
    @filter_q = params[:q].to_s.strip
    @archived = deserialize_bool_param(params[:archived])

    # Render a turbo-frame-wrapped template so Turbo can match the frame id
    render template: 'teams2/books_fragment', layout: false
  end

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

  # Simple server-side add-member by email (no AJAX). Looks up an existing user
  # by email and adds to the team if found.
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

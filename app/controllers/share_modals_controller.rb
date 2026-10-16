# frozen_string_literal: true

# Renders one record's share/unshare forms into the share modal Turbo Frame on the
# cases, books, scorers and search endpoints indexes and the team page. The core
# case page's share modal has its own contract; see Core::ModalCatalogsController#sharing.
class ShareModalsController < ApplicationController
  RECORD_TYPES = {
    'case'            => { scope: :cases_involved_with, share_path: :share_case_teams_path,
                           unshare_path: :unshare_case_teams_path },
    'book'            => { scope: :books_involved_with, share_path: :share_book_teams_path,
                           unshare_path: :unshare_book_teams_path },
    'scorer'          => { scope: :scorers_involved_with, share_path: :share_scorers_path,
                           unshare_path: :unshare_scorers_path },
    'search_endpoint' => { scope: :search_endpoints_involved_with, share_path: :share_search_endpoint_teams_path,
                           unshare_path: :unshare_search_endpoint_teams_path },
  }.freeze

  def show
    @record_type = params.expect(:record_type)
    config = RECORD_TYPES.fetch(@record_type)
    @share_path = send(config[:share_path])
    @unshare_path = send(config[:unshare_path])
    @record = current_user.public_send(config[:scope]).find_by(id: params[:id])
    return render(layout: false, status: :not_found) unless @record

    shared_teams = @record.teams.select(:id, :name)
    shared_teams = shared_teams.where(id: current_user.teams.select(:id)) if member_teams_only?
    @shared_teams = shared_teams.to_a
    @all_teams = current_user.teams.select(:id, :name).order(:name).to_a
    shared_ids = @shared_teams.map(&:id)
    @shareable_teams = @all_teams.reject { |team| shared_ids.include?(team.id) }
    render layout: false
  end

  private

  # A scorer's shared list shows only the viewer's own teams, except when opened
  # from the page of a team the viewer belongs to that has the scorer; there it
  # lists every team, as that page always has. Other record types list every team.
  def member_teams_only?
    return false unless @record.is_a?(Scorer)

    team = current_user.teams.find_by(id: params[:team_id])
    !team&.scorers&.exists?(@record.id)
  end
end

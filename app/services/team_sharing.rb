# frozen_string_literal: true

# Controllers own lookup errors, flash messages and response formats. This service
# owns authorization, idempotent membership changes and sharing side effects.
class TeamSharing
  class AccessDenied < ActiveRecord::RecordNotFound; end

  ASSOCIATIONS = { 'Case' => :cases, 'Book' => :books, 'Scorer' => :scorers, 'SearchEndpoint' => :search_endpoints }.freeze

  def initialize user, team = nil
    @user = user
    @team = user.teams.find(team.id) if team
  end

  # Resolve every submitted ID before changing membership. Hidden existing teams
  # belong to other collaborators and must survive edits to the visible checkboxes.
  def assign_teams record, submitted_ids
    selected = @user.teams.find(Array(submitted_ids).compact_blank.uniq)
    hidden = record.teams.where.not(id: @user.teams.select(:id)).to_a
    record.teams = (hidden + selected).uniq
  end

  def share record
    association = authorized_association(record)
    changed = false
    @team.with_lock do
      changed = !association.exists?(record.id)
      association << record if changed
      if record.is_a?(Case)
        endpoint = record.tries.latest&.search_endpoint
        @team.search_endpoints << endpoint if endpoint && !@team.search_endpoints.exists?(endpoint.id)
      end
    end
    track_shared(record) if changed
    changed
  end

  # rubocop:disable-next Naming/PredicateMethod -- Membership mutation, not a predicate.
  def unshare record
    association = authorized_association(record)
    return false unless association.exists?(record.id)

    association.delete(record)
    true
  end

  private

  def authorized_association record
    name = ASSOCIATIONS.fetch(record.class.name)
    scope = @user.public_send("#{name}_involved_with")
    raise AccessDenied.new(nil, record.class.name) unless scope.exists?(record.id)

    @team.public_send(name)
  end

  def track_shared record
    case record
    when Case
      Analytics::Tracker.track_case_shared_event @user, record, @team
    when Book
      Analytics::Tracker.track_book_shared_event @user, record, @team
    when SearchEndpoint
      Analytics::Tracker.track_search_endpoint_shared_event @user, record, @team
    when Scorer
      Analytics::Tracker.track_scorer_shared_event @user, record, @team
    end
  end
end

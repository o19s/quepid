# frozen_string_literal: true

# Controllers own lookup errors, flash messages and response formats. This service
# owns authorization, idempotent membership changes and sharing side effects.
class TeamSharing
  ASSOCIATIONS = { 'Case' => :cases, 'Book' => :books, 'Scorer' => :scorers, 'SearchEndpoint' => :search_endpoints }.freeze

  def initialize user, team
    @user = user
    @team = user.teams.find(team.id)
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
    raise ActiveRecord::RecordNotFound unless scope.exists?(record.id)

    @team.public_send(name)
  end

  def track_shared record
    case record
    when Case
      Analytics::Tracker.track_case_shared_event @user, record, @team
    when Book
      Analytics::Ahoy.create_event(category: 'Books', action: 'Shared a Book', label: record.name, value: nil)
    when SearchEndpoint
      Analytics::Ahoy.create_event(category: 'Search Endpoints', action: 'Shared a Search Endpoint', label: record.fullname, value: nil)
    when Scorer
      Analytics::Tracker.track_scorer_shared_event @user, record, @team
    end
  end
end

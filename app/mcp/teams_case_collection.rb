# frozen_string_literal: true

class TeamsCaseCollection < QuepidCollection
  model TeamsCase
  description 'A case shared with a team.'
  fields :case, :team

  instructions <<~TXT
    Which cases are shared with which teams; answers "who else can see this case". A case shared
    with three teams appears three times, so a row is not one case.
  TXT

  def scope_for user
    TeamsCase.where(team_id: user.teams.select(:id))
  end
end

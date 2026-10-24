# frozen_string_literal: true

class TeamCollection < QuepidCollection
  model Team
  description 'A group of users sharing cases, books, scorers and endpoints.'
  fields :id, :name, :created_at, :updated_at

  instructions <<~TXT
    Teams you belong to. A team shares cases, books, scorers and search endpoints between users.
    Which cases a team shares is in "teams_case".
  TXT

  def scope_for user
    Team.where(id: user.teams.select(:id))
  end
end

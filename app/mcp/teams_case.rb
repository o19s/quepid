# frozen_string_literal: true

# The teams_cases join table (Case/Team has_and_belongs_to_many) as a read-only
# model, so the MCP server can publish it as a collection. Only used by MCP.
class TeamsCase < ApplicationRecord
  self.table_name  = 'teams_cases'
  self.primary_key = [ :case_id, :team_id ]

  belongs_to :case
  belongs_to :team

  def readonly?
    true
  end
end

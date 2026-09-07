# frozen_string_literal: true

module ForUserScope
  extend ActiveSupport::Concern

  included do
    scope :for_user, ->(user) do
      direct = where(owner: user)
      by_team = left_joins(teams: :members).where(teams_members: { member_id: user.id })

      # Match on ids rather than SELECT DISTINCT over every column. The join can
      # return a row per team member, so the duplicates are real, but `IN` folds
      # them without asking the database to compare whole rows - which it cannot
      # do here anyway once a json column is in the table.
      where(id: by_team.or(direct).select(:id))
    end
  end
end

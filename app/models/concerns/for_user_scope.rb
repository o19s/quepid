# frozen_string_literal: true

module ForUserScope
  extend ActiveSupport::Concern

  included do
    scope :for_user, ->(user) do
      direct = where(owner: user)

      # Scoped as "my team is one of the user's teams" (an id subquery on
      # the includer's own `teams` association) rather than
      # `left_joins(teams: :members).where(teams_members: ...)`. The
      # latter re-walks the same join table twice when the includer's own
      # team-membership table happens to equal `Team#members`'s join
      # table (e.g. User, whose `teams` association *is* `teams_members`)
      # - Rails then binds the `where` to the wrong occurrence and the
      # scope silently degenerates to "record is literally `user`". This
      # form never revisits a table, so it's safe for every includer.
      by_team = left_joins(:teams).where(teams: { id: user.teams.select(:id) })

      # Match on ids rather than SELECT DISTINCT over every column. The join can
      # return a row per matching team, so the duplicates are real, but `IN`
      # folds them without asking the database to compare whole rows - which it
      # cannot do here anyway once a json column is in the table.
      where(id: by_team.or(direct).reselect(:id))
    end
  end
end

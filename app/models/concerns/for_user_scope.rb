# frozen_string_literal: true

module ForUserScope
  extend ActiveSupport::Concern

  included do
    scope :for_user, ->(user) do
      direct = where(owner: user)
      by_team = left_joins(teams: :members).where(teams_members: { member_id: user.id })
      ids = by_team.or(direct).pluck(:id)
      where(id: ids.uniq)
    end
  end
end

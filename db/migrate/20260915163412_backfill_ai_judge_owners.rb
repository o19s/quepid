# frozen_string_literal: true

class BackfillAiJudgeOwners < ActiveRecord::Migration[8.1]
  # AI judges created before the ownership model (added in the preceding
  # add_owner_id_to_users migration) have no owner. Best-effort backfill:
  # pick the oldest human member of any team the judge belongs to as a
  # plausible "creator". A judge with no team has no one to pick, and is
  # left ownerless.
  def up
    User.only_ai_judges.where(owner_id: nil).find_each do |judge|
      oldest_teammate = User
        .where(llm_key: nil)
        .joins(:teams)
        .where(teams: { id: judge.teams.select(:id) })
        .order(:created_at)
        .first

      judge.update_column(:owner_id, oldest_teammate.id) if oldest_teammate
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end

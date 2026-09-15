# frozen_string_literal: true

class BackfillAiJudgeOwners < ActiveRecord::Migration[8.1]
  # AI judges created before the ownership model (added in the preceding
  # add_owner_id_to_users migration) have no owner. Best-effort backfill:
  # pick the oldest human member of any team the judge belongs to as a
  # plausible "creator". A judge with no team has no one to pick, and is
  # left ownerless.
  def up
    # Query by llm_key directly, not the `only_ai_judges`/`type` scope: this
    # migration runs before add_type_to_users, so the `type` column doesn't
    # exist in the table yet at this point in a fresh `db:migrate` replay.
    User.where.not(llm_key: nil).where(owner_id: nil).find_each do |judge|
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

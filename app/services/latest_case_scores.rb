# frozen_string_literal: true

# Rank only the requested histories once, then hydrate one score per case.
class LatestCaseScores
  def self.preload cases
    records = cases.to_a
    ids = records.map(&:id)
    return if ids.empty?

    ranked = Score.where(case_id: ids).select(<<~SQL.squish)
      case_scores.id,
      ROW_NUMBER() OVER (
        PARTITION BY case_scores.case_id
        ORDER BY case_scores.updated_at DESC, case_scores.created_at DESC, case_scores.id DESC
      ) AS latest_rank
    SQL
    latest_ids = "SELECT id FROM (#{ranked.to_sql}) ranked_scores WHERE latest_rank = 1"
    scope = Score.where("case_scores.id IN (#{latest_ids})").includes(:user)
    ActiveRecord::Associations::Preloader.new(records: records, associations: :latest_score, scope: scope).call
  end
end

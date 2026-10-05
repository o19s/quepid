# frozen_string_literal: true

# The API's deep case lists include ten randomly sampled score points per case.
# Sample in SQL before hydrating scores, then preload only those annotations.
class CaseScoreSamples
  def self.load cases
    ids = cases.map(&:id)
    return {} if ids.empty?

    ranked = Score.where(case_id: ids).select(<<~SQL.squish)
      case_scores.id,
      ROW_NUMBER() OVER (
        PARTITION BY case_scores.case_id ORDER BY #{AdapterFunctions.random_function}
      ) AS sample_rank
    SQL
    sampled_ids = "SELECT id FROM (#{ranked.to_sql}) score_samples WHERE sample_rank <= 10"
    Score.where("case_scores.id IN (#{sampled_ids})")
      .order(updated_at: :desc).includes(:annotation).group_by(&:case_id)
  end
end

# frozen_string_literal: true

class ScorerCollection < QuepidCollection
  model Scorer
  description 'A metric cases are graded with.'
  fields :id, :name, :scale, :scale_with_labels, :communal, :show_scale_labels,
         :created_at, :updated_at

  computed :owner_id, :integer, sql: '{table}.owner_id', doc: 'id of the owning user; null for communal scorers'

  instructions <<~TXT
    The metric a case is graded with (nDCG@10, AP@10, a custom one...). "communal" marks Quepid's
    built-in scorers, visible to everyone. case.scorer_id points here as a raw id.
  TXT

  def scope_for user
    Scorer.where(id: user.scorers_involved_with.reselect(:id))
  end
end

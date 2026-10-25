# frozen_string_literal: true

class SnapshotCollection < QuepidCollection
  model Snapshot
  description 'Frozen search results of a case at a point in time.'
  fields :id, :name, :case, :try, :scorer, :created_at, :updated_at

  instructions <<~TXT
    A snapshot freezes the search results of every query in a case at a point in time, so runs can
    be compared. Per-query scores are in "snapshot_query" ($match {"snapshot": <id>}).
  TXT

  def scope_for user
    Snapshot.where(case_id: visible_case_ids(user))
  end
end

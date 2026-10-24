# frozen_string_literal: true

class SnapshotQueryCollection < QuepidCollection
  model SnapshotQuery
  description "One query's score inside a snapshot."
  fields :id, :query, :snapshot, :score, :all_rated, :number_of_results, :response_status

  instructions <<~TXT
    One query's outcome inside a snapshot: score, result count, and the HTTP status of the search.
    "score" is null when the query was never scored; a non-200 "response_status" means the search
    failed. There are no timestamps here: order by the snapshot's created_at.
  TXT

  def scope_for user
    SnapshotQuery.joins(:snapshot).where(snapshots: { case_id: visible_case_ids(user) })
  end
end

# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshot_queries
#
#  id                :integer          not null, primary key
#  all_rated         :boolean
#  number_of_results :integer
#  response_status   :integer
#  score             :float(24)
#  query_id          :integer
#  snapshot_id       :integer
#
# Indexes
#
#  query_id     (query_id)
#  snapshot_id  (snapshot_id)
#
# Foreign Keys
#
#  snapshot_queries_ibfk_1  (query_id => queries.id)
#  snapshot_queries_ibfk_2  (snapshot_id => snapshots.id)
#

class SnapshotQuery < ApplicationRecord
  belongs_to  :snapshot, optional: true # shouldn't be
  belongs_to  :query, optional: true # shouldn't be
  has_one     :web_request, dependent: :destroy
  has_many    :snapshot_docs, -> { order(position: :asc) },
              dependent:  :destroy,
              inverse_of: :snapshot_query
end

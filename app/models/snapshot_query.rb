# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshot_queries
#
#  id          :integer          not null, primary key
#  query_id    :integer
#  snapshot_id :integer
#

class SnapshotQuery < ActiveRecord::Base
  belongs_to  :snapshot
  belongs_to  :query
  has_many    :snapshot_docs, -> { order(position: :asc) },
              dependent:  :destroy,
              inverse_of: :snapshot_query
end

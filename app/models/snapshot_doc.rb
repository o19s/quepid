# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshot_docs
#
#  id                :integer          not null, primary key
#  explain           :text(16777215)
#  fields            :text(16777215)
#  position          :integer
#  rated_only        :boolean          default(FALSE)
#  doc_id            :string(500)
#  snapshot_query_id :integer
#
# Indexes
#
#  snapshot_query_id  (snapshot_query_id)
#
# Foreign Keys
#
#  snapshot_docs_ibfk_1  (snapshot_query_id => snapshot_queries.id)
#

class SnapshotDoc < ApplicationRecord
  belongs_to :snapshot_query, optional: true # shouldn't be

  acts_as_list column: :position, add_new_at: :bottom, scope: :snapshot_query
end

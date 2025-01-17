# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshots
#
#  id         :integer          not null, primary key
#  name       :string(250)
#  created_at :datetime
#  updated_at :datetime         not null
#  case_id    :integer
#  scorer_id  :bigint
#  try_id     :bigint
#
# Indexes
#
#  case_id                       (case_id)
#  index_snapshots_on_scorer_id  (scorer_id)
#  index_snapshots_on_try_id     (try_id)
#
# Foreign Keys
#
#  snapshots_ibfk_1  (case_id => cases.id)
#

require 'test_helper'

class SnapshotTest < ActiveSupport::TestCase
  describe 'default name' do
    let(:acase) { cases(:random_case) }

    test 'sets default name with current date' do
      snapshot = Snapshot.create(case: acase)

      assert_equal "Snapshot #{Time.zone.now.strftime('%D')}", snapshot.name
    end

    test 'sets default name with current date if name is an empty string' do
      snapshot = Snapshot.create(case: acase, name: '')

      assert_equal "Snapshot #{Time.zone.now.strftime('%D')}", snapshot.name
    end

    test 'does not override name with default' do
      name = "Don't override me"
      snapshot = Snapshot.create(case: acase, name: name)

      assert_equal name, snapshot.name
    end
  end

  describe 'deleting a snapshot' do
    let(:asnapshot) { snapshots(:a_snapshot) }
    let(:snapshot_query) { snapshot_queries(:first_snapshot_query) }

    test 'deleting a snapshot cascades down' do
      assert 4, asnapshot.snapshot_docs.size

      sq = asnapshot.snapshot_queries.first
      sq.web_request = WebRequest.create
      sq.save!
      assert sq.web_request.persisted?

      snapshots_to_delete = []
      snapshots_to_delete << asnapshot
      snapshots_to_delete.each(&:destroy!)
      # assert asnapshot.destroy!

      assert_raises(ActiveRecord::RecordNotFound) do
        SnapshotQuery.find(snapshot_query.id)
      end

      assert_raises(ActiveRecord::RecordNotFound) do
        WebRequest.find(sq.id)
      end
      # snapshot = Snapshot.create(case: acase)

      # assert_equal "Snapshot #{Time.zone.now.strftime('%D')}", snapshot.name
    end
  end
end

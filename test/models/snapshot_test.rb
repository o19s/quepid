# frozen_string_literal: true

# == Schema Information
#
# Table name: snapshots
#
#  id         :integer          not null, primary key
#  name       :string(250)
#  created_at :datetime
#  case_id    :integer
#  updated_at :datetime         not null
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
end

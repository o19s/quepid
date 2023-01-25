# frozen_string_literal: true

# == Schema Information
#
# Table name: scorers
#
#  id                :integer          not null, primary key
#  code              :text(65535)
#  communal          :boolean          default(FALSE)
#  name              :string(255)
#  scale             :string(255)
#  scale_with_labels :text(65535)
#  show_scale_labels :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  owner_id          :integer
#

require 'test_helper'

class ScorerTest < ActiveSupport::TestCase
  describe 'defaults' do
    test 'sets a default name to a scorer' do
      scorer = Scorer.new

      assert_not_nil  scorer.name
      assert_not      scorer.name.blank?
      assert_equal    scorer.name, "Scorer #{Scorer.count + 1}"
    end

    test 'handles empty string names' do
      scorer = Scorer.new name: ''

      assert_not_nil  scorer.name
      assert_not      scorer.name.blank?
      assert_equal    scorer.name, "Scorer #{Scorer.count + 1}"
    end
  end

  describe 'emoji support' do
    test 'handles emoji in name' do
      scorer = Scorer.create name: '👍 👎 💩'

      assert_equal scorer.name, '👍 👎 💩'
    end

    test 'handles emoji in code' do
      scorer = Scorer.create code: '// 👍 👎 💩'

      assert_equal scorer.code, '// 👍 👎 💩'
    end

    test 'handles emoji in scale_with_labels' do
      scorer = Scorer.create scale_with_labels: { '1' => '👍' }

      assert_equal scorer.scale_with_labels, '1' => '👍'
    end
  end
end

# frozen_string_literal: true

# == Schema Information
#
# Table name: annotations
#
#  id         :integer          not null, primary key
#  message    :text(65535)
#  source     :string(255)
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  user_id    :integer
#
# Indexes
#
#  index_annotations_on_user_id  (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#

require 'test_helper'

class AnnotationTest < ActiveSupport::TestCase
  describe 'validations' do
    test 'requires a user' do
      annotation = Annotation.new message: 'a message'

      assert_not annotation.valid?
      assert_includes annotation.errors[:user], 'must exist'
    end

    test 'is valid with a user' do
      annotation = Annotation.new message: 'a message', user: users(:random)

      assert_predicate annotation, :valid?
    end
  end

  describe 'associations' do
    let(:annotation) { annotations(:one) }
    let(:score)      { scores(:score_with_annotation) }

    test 'belongs to a user' do
      assert_equal users(:random), annotation.user
    end

    test 'has one score' do
      assert_equal score, annotation.score
    end

    test 'has one case through score' do
      assert_equal cases(:other_score_case), annotation.case
    end

    test 'has no case when it has no score' do
      annotation = Annotation.create! message: 'orphan', user: users(:random)

      assert_nil annotation.score
      assert_nil annotation.case
    end

    test 'destroying the annotation destroys its score' do
      annotation = Annotation.create! message: 'to be destroyed', user: users(:random)
      score = scores(:score_for_first_try)
      score.update! annotation: annotation

      assert_difference 'Score.count', -1 do
        annotation.destroy
      end

      assert_nil Score.find_by(id: score.id)
    end
  end

  describe 'default scope' do
    test 'orders annotations by updated_at descending' do
      older = Annotation.create! message: 'older', user: users(:random), updated_at: 2.days.ago
      newer = Annotation.create! message: 'newer', user: users(:random), updated_at: 1.hour.ago

      ordered_ids = Annotation.pluck(:id)

      assert_operator ordered_ids.index(newer.id), :<, ordered_ids.index(older.id)
    end
  end
end

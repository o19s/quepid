# frozen_string_literal: true

# == Schema Information
#
# Table name: judgements
#
#  id                :bigint           not null, primary key
#  explanation       :text(65535)
#  judge_later       :boolean          default(FALSE)
#  rating            :float(24)
#  unrateable        :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  escalated_from_id :bigint
#  query_doc_pair_id :bigint           not null
#  user_id           :integer
#
# Indexes
#
#  index_judgements_on_escalated_from_id              (escalated_from_id) UNIQUE
#  index_judgements_on_query_doc_pair_id              (query_doc_pair_id)
#  index_judgements_on_user_id_and_query_doc_pair_id  (user_id,query_doc_pair_id) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (escalated_from_id => judgements.id) ON DELETE => nullify
#  fk_rails_...  (query_doc_pair_id => query_doc_pairs.id)
#
require 'test_helper'

class JudgementTest < ActiveSupport::TestCase
  describe 'uniqueness of judgements' do
    let(:query_doc_pair) { query_doc_pairs(:one) }
    let(:user) { users(:random) }
    let(:user2) { users(:doug) }

    test 'Prevent saving two judgements from the same user' do
      judgement = Judgement.create(user: user, query_doc_pair: query_doc_pair, rating: 4.4)
      assert judgement.save

      duplicate_judgement = Judgement.create(user: user, query_doc_pair: query_doc_pair, rating: 1.0)
      assert_not duplicate_judgement.save
      assert_includes duplicate_judgement.errors, :user_id

      judgement2 = Judgement.create(user: user2, query_doc_pair: query_doc_pair, rating: 1.0)
      assert judgement2.save
    end

    test 'However multiple anonymous judgements is okay' do
      judgement = Judgement.create(user: nil, query_doc_pair: query_doc_pair, rating: 4.4)
      assert judgement.save

      duplicate_judgement = Judgement.create(user: nil, query_doc_pair: query_doc_pair, rating: 1.0)
      assert duplicate_judgement.save
      assert_not duplicate_judgement.errors.include?(:user_id)
    end
  end
  describe 'unrateable attribute behavior' do
    let(:query_doc_pair) { query_doc_pairs(:one) }

    test 'Saving a judgement marks unrateable as false' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair, rating: 4.4)
      assert_not judgement.unrateable
    end

    test "a judgement with no rating that isn't marked unrateable fails" do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      assert_not judgement.unrateable
      assert_not judgement.valid?
      assert_includes judgement.errors, :rating
    end

    test 'mark a judgement with no ratings as unratable works' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      judgement.mark_unrateable!
      assert judgement.unrateable

      assert_predicate judgement, :valid?
    end

    test 'mark a judgement with ratings as unrateble clears exiting rating' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair, rating: 4.4)
      judgement.mark_unrateable!
      assert_nil judgement.rating
    end

    test 'set a rating on a judgement that was marked unrateable, flips it to rateable' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      judgement.mark_unrateable!
      assert judgement.unrateable
      judgement.rating = 4
      assert_not judgement.unrateable
      assert_predicate judgement, :valid?
    end
  end

  describe 'judge_later attribute behavior' do
    let(:query_doc_pair) { query_doc_pairs(:one) }

    test 'Saving a judgement marks unrateable as false' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair, rating: 4.4)
      assert_not judgement.judge_later
    end

    test "a judgement with no rating that isn't marked judge_later fails" do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      assert_not judgement.judge_later
      assert_not judgement.valid?
      assert_includes judgement.errors, :rating
    end

    test 'mark a judgement with no ratings as judge_later works' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      judgement.mark_judge_later!
      assert judgement.judge_later

      assert_predicate judgement, :valid?
    end

    test 'mark a judgement with ratings as judge_later clears exiting rating' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair, rating: 4.4)
      judgement.mark_judge_later!
      assert_nil judgement.rating
    end

    test 'set a rating on a judgement that was marked judge_later, flips it to rateable' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      judgement.mark_judge_later!
      assert judgement.judge_later
      judgement.rating = 4
      assert_not judgement.judge_later
      assert_predicate judgement, :valid?
    end
  end

  describe 'unrateable_reason' do
    let(:pair) { query_doc_pairs(:jbm_qdp1) }
    let(:ai) { AiJudge.create!(name: 'Robo') }

    def reason_for explanation, user: ai, unrateable: true
      Judgement.new(query_doc_pair: pair, user: user, unrateable: unrateable, explanation: explanation).unrateable_reason
    end

    it 'names the confidence floor, with both numbers' do
      assert_equal 'its confidence (0.2) was below its minimum confidence of 0.5',
                   reason_for("Jev rated 0. [confidence 0.2 is below this judge's minimum confidence of 0.5, so it was marked unrateable]")
    end

    it 'names an off-scale rating, a failed call, and a missing rating' do
      assert_equal "its rating wasn't one of the book's scale values", reason_for('Good. [LLM returned rating 2.0, outside the scale [0, 1]]')
      assert_equal 'the call to the model failed', reason_for('BOOM: API request failed: timeout')
      assert_equal 'it gave no rating', reason_for(nil)
    end

    it 'gives an escalated judgement its own reason, not the one it quotes from the judge before it' do
      source = pair.judgements.create!(user: ai, unrateable: true)
      escalated = Judgement.new(query_doc_pair: pair, user: AiJudge.create!(name: 'Backup'), unrateable: true, escalated_from: source,
                                explanation: 'Escalated from Robo, whose answer was unrateable: Jev rated 1. [confidence 0.73 is ' \
                                             "below this judge's minimum confidence of 0.8, so it was marked unrateable]\n\n" \
                                             'Mostly relevant. [LLM returned rating 2.0, outside the scale [0, 1]]')

      assert_equal "its rating wasn't one of the book's scale values", escalated.unrateable_reason
    end

    it 'says nothing for a rateable judgement or a person' do
      assert_nil reason_for('fine', unrateable: false)
      assert_nil reason_for('no idea', user: users(:matt))
    end
  end
end

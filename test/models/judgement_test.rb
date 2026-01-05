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
#  query_doc_pair_id :bigint           not null
#  user_id           :integer
#
# Indexes
#
#  index_judgements_on_query_doc_pair_id              (query_doc_pair_id)
#  index_judgements_on_user_id_and_query_doc_pair_id  (user_id,query_doc_pair_id) UNIQUE
#
# Foreign Keys
#
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
end

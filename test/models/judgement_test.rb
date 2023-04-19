# frozen_string_literal: true

# == Schema Information
#
# Table name: judgements
#
#  id                :bigint           not null, primary key
#  rating            :float(24)
#  unrateable        :boolean          default(FALSE)
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  query_doc_pair_id :bigint           not null
#  user_id           :integer
#
# Indexes
#
#  index_judgements_on_query_doc_pair_id  (query_doc_pair_id)
#
# Foreign Keys
#
#  fk_rails_...  (query_doc_pair_id => query_doc_pairs.id)
#
require 'test_helper'

class JudgementTest < ActiveSupport::TestCase
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
      assert judgement.errors.include?(:rating)
    end

    test 'mark a judgement with no ratings as unratable works' do
      judgement = Judgement.create(query_doc_pair: query_doc_pair)
      judgement.mark_unrateable!
      assert judgement.unrateable

      assert judgement.valid?
    end
  end
end

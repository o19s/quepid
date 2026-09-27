# frozen_string_literal: true

# == Schema Information
#
# Table name: query_doc_pairs
#
#  id               :bigint           not null, primary key
#  document_fields  :text(16777215)
#  information_need :string(255)
#  notes            :text(65535)
#  options          :json
#  position         :integer
#  query_text       :string(2048)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  book_id          :bigint           not null
#  doc_id           :string(500)
#
# Indexes
#
#  index_query_doc_pairs_on_book_id  (book_id)
#
# Foreign Keys
#
#  fk_rails_...  (book_id => books.id)
#
require 'test_helper'

class QueryDocPairTest < ActiveSupport::TestCase
  describe 'emoji support' do
    let(:book) { books(:james_bond_movies) }
    test 'handles emoji in document_fields' do
      query_doc_pair = QueryDocPair.create document_fields: '👍 👎 💩'

      assert_equal '👍 👎 💩', query_doc_pair.document_fields
    end

    describe 'auto-run AI judges' do
      # james_bond_movies already has judge_judy assigned as an AI judge via
      # fixtures, so use a book with no existing assignment to avoid a
      # duplicate books_ai_judges row.
      let(:book) { books(:book_of_star_wars_judgements) }
      let(:ai_judge) { users(:judge_judy) }

      it 'queues an auto-run AI judge when a new pair is created' do
        book.books_ai_judges.create!(ai_judge: ai_judge, auto_run: true)

        assert_enqueued_with(job: RunJudgeJudyJob, args: [ book, ai_judge, nil ]) do
          book.query_doc_pairs.create!(query_text: 'auto run test', doc_id: 'auto_run_doc_1',
                                       document_fields: '{"title":"Test"}')
        end
      end

      it 'does not queue an AI judge that is not set to auto-run' do
        book.books_ai_judges.create!(ai_judge: ai_judge, auto_run: false)

        assert_no_enqueued_jobs(only: RunJudgeJudyJob) do
          book.query_doc_pairs.create!(query_text: 'auto run test', doc_id: 'auto_run_doc_2',
                                       document_fields: '{"title":"Test"}')
        end
      end
    end

    describe 'case sensitivity' do
      test 'query_text is case sensitive' do
        # Create a query_doc_pair with uppercase query_text
        uppercase_pair = QueryDocPair.create!(
          query_text:      'TEST QUERY',
          doc_id:          'test_doc_1',
          document_fields: { title: 'Test Document' }.to_json,
          book:            book
        )

        # Try to find the pair using lowercase query_text
        lowercase_result = QueryDocPair.find_by(query_text: 'test query')

        # With the case-sensitive collation, this should return nil
        assert_nil lowercase_result, 'Should not find a record with different case'

        # But should find with exact case match
        exact_case_result = QueryDocPair.find_by(query_text: 'TEST QUERY')
        assert_not_nil exact_case_result
        assert_equal uppercase_pair.id, exact_case_result.id
      end
    end
  end
end

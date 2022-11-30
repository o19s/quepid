# == Schema Information
#
# Table name: books
#
#  id                    :bigint           not null, primary key
#  name                  :string(255)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  scorer_id             :integer
#  selection_strategy_id :bigint           not null
#  team_id               :integer
#
# Indexes
#
#  index_books_on_selection_strategy_id  (selection_strategy_id)
#
# Foreign Keys
#
#  fk_rails_...  (selection_strategy_id => selection_strategies.id)
#
class Book < ApplicationRecord
  belongs_to :selection_strategy
  has_many :query_doc_pairs, dependent: :destroy

  def get_random_query_doc_pair_id
    @all_query_doc_pairs = QueryDocPair.where(:book_id => self.id)
    item = @all_query_doc_pairs[rand(@all_query_doc_pairs.size)]
    return item.id
  end
end

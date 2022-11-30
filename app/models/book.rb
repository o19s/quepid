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

  def get_random_query_doc_pair_id(user_id)
    @all_query_doc_pairs_with_judgements =
      QueryDocPair.joins("LEFT JOIN judgements on "\
    + "judgements.query_doc_pair_id = query_doc_pairs.id "\
    + " and judgements.user_id = '#{user_id}'").where(:book_id => self.id)

    @all_possible_query_doc_pair_ids_to_rate = []
    @all_query_doc_pairs_with_judgements.each do |row|
      puts row.id
      if row.judgements[0] == nil
        @all_possible_query_doc_pair_ids_to_rate << row.id
      end
    end

    size_ary = @all_possible_query_doc_pair_ids_to_rate.size
    puts "size: #{size_ary}"
    if size_ary == 0
      return -1
    else
      id = @all_possible_query_doc_pair_ids_to_rate[rand(size_ary)]
      return id
    end
  end
end

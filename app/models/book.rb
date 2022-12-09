# frozen_string_literal: true

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
  belongs_to :team
  belongs_to :selection_strategy
  belongs_to :scorer
  has_many :query_doc_pairs, dependent: :destroy
  has_many   :judgements,
             through:   :query_doc_pairs,
             dependent: :destroy

  scope :for_user, ->(user) {
    joins('
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `books`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
        `teams_members`.`member_id` = ?
    ', user.id)
  }

  # rubocop:disable Metrics/MethodLength
  def get_random_query_doc_pair_id user_id, query_doc_pair_id_to_exclude = nil
    @all_query_doc_pairs_with_judgements =
      QueryDocPair.joins("
        LEFT JOIN `judgements` on `judgements`.`query_doc_pair_id` = `query_doc_pairs`.`id`
        AND `judgements`.`user_id` = '#{user_id}'").where(:book_id => id)

    @all_possible_query_doc_pair_ids_to_rate = []
    @all_query_doc_pairs_with_judgements.each do |row|
      @all_possible_query_doc_pair_ids_to_rate << row.id if row.judgements[0].nil?
    end
    unless query_doc_pair_id_to_exclude.nil?
      @all_possible_query_doc_pair_ids_to_rate.delete(query_doc_pair_id_to_exclude)
    end
    size_ary = @all_possible_query_doc_pair_ids_to_rate.size
    if size_ary.zero?
      -1
    else
      id = @all_possible_query_doc_pair_ids_to_rate[rand(size_ary)]
      id
    end
  end
  # rubocop:enable Metrics/MethodLength
end

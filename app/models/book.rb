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
      .order(name: :desc)
  }

  has_many :rated_query_doc_pairs, -> { has_judgements },
           class_name: 'QueryDocPair',
           dependent:  :destroy,
           inverse_of: :book
end

# frozen_string_literal: true

# == Schema Information
#
# Table name: books
#
#  id                          :bigint           not null, primary key
#  name                        :string(255)
#  show_rank                   :boolean          default(FALSE)
#  support_implicit_judgements :boolean
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  owner_id                    :integer
#  scorer_id                   :integer
#  selection_strategy_id       :bigint           not null
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
  # Associations
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_books'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :owner,
             class_name: 'User', optional: true

  belongs_to :selection_strategy
  belongs_to :scorer
  has_many :query_doc_pairs, dependent: :destroy, autosave: true
  has_many   :judgements, -> { order('query_doc_pair_id') },
             through:   :query_doc_pairs,
             dependent: :destroy

  has_many :cases, dependent: :nullify

  has_many :rated_query_doc_pairs, -> { has_judgements },
           class_name: 'QueryDocPair',
           dependent:  :destroy,
           inverse_of: :book

  has_many :metadata,
           class_name: 'BookMetadatum',
           dependent:  :destroy

  has_one_attached :import_file
  has_one_attached :export_file
  has_one_attached :populate_file

  after_destroy :delete_attachments

  # Scopes
  scope :for_user_via_teams, ->(user) {
    joins('
      LEFT OUTER JOIN `teams_books` ON `teams_books`.`book_id` = `books`.`id`
      LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_books`.`team_id`
      LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
      LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
    ').where('
        `teams_members`.`member_id` = ?
    ', user.id)
      .order(name: :desc)
  }

  scope :for_user_directly_owned, ->(user) {
    where('
        `books`.`owner_id` = ?
    ',  user.id)
  }

  scope :for_user, ->(user) {
    ids = for_user_via_teams(user).pluck(:id) + for_user_directly_owned(user).pluck(:id)
    where(id: ids.uniq)
  }

  private

  def delete_attachments
    import_file.purge_later
    export_file.purge_later
    populate_file.purge_later
  end
end

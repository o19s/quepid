# frozen_string_literal: true

# == Schema Information
#
# Table name: books
#
#  id                          :bigint           not null, primary key
#  export_job                  :string(255)
#  import_job                  :string(255)
#  name                        :string(255)
#  populate_job                :string(255)
#  query_doc_pairs_count       :integer          default(0), not null
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

  # belongs_to :ai_judge,
  #           class_name: 'User', optional: true
  #
  # has_many :users, dependent: :destroy
  # has_many :ai_judges, through: :ai_judges

  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :ai_judges,
                          class_name: 'User',
                          join_table: 'books_ai_judges'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :selection_strategy
  belongs_to :scorer
  has_many :query_doc_pairs, dependent: :destroy, autosave: true

  has_many   :judgements,
             through:   :query_doc_pairs,
             dependent: :destroy

  # has_many :judges, -> { distinct }, through: :judgements, class_name: 'User', source: :user

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
  include ForUserScope

  private

  def delete_attachments
    import_file.purge_later
    export_file.purge_later
    populate_file.purge_later
  end
end

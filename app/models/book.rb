# frozen_string_literal: true

# == Schema Information
#
# Table name: books
#
#  id                          :bigint           not null, primary key
#  archived                    :boolean          default(FALSE), not null
#  export_job                  :string(255)
#  import_job                  :string(255)
#  name                        :string(255)
#  populate_job                :string(255)
#  scale                       :string(255)
#  scale_with_labels           :text(65535)
#  scoring_guidelines          :text(65535)
#  show_rank                   :boolean          default(FALSE)
#  support_implicit_judgements :boolean
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  owner_id                    :integer
#
# Indexes
#
#  index_books_owner_id  (owner_id)
#
#  id                          :bigint           not null, primary key
#  archived                    :boolean          default(FALSE), not null
#  export_job                  :string(255)
#  import_job                  :string(255)
#  name                        :string(255)
#  populate_job                :string(255)
#  show_rank                   :boolean          default(FALSE)
#  support_implicit_judgements :boolean
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  owner_id                    :integer
#  scorer_id                   :integer

#
# Indexes
#

#  index_books_owner_id                  (owner_id)
#
# Foreign Keys
#
#  fk_rails_...  (selection_strategy_id => selection_strategies.id)
#
require 'scale_serializer'

class Book < ApplicationRecord
  # Default scoring guidelines templates
  FOUR_POINT_GUIDELINES = <<~MARKDOWN
    **0 - Poor:** *Terrible results!* Clearly not desired. These are negative examples.
    **1 - Fair:** *Not what I'm looking for, but I see why.* Has some right words but misses the point.
    **2 - Good:** *Worth my time!* Provides partial or survey-level information.
    **3 - Perfect:** *Exactly what I need!* Reserved for targeted, exact results.

    [Judgement Rating Best Practices](https://github.com/o19s/quepid/wiki/Judgement-Rating-Best-Practices)
  MARKDOWN

  TWO_POINT_GUIDELINES = <<~MARKDOWN
    **0 - Irrelevant:** Not helpful. These are not the droids I'm looking for.
    **1 - Relevant:** Addresses some aspect of my information need.

    [Judgement Rating Best Practices](https://github.com/o19s/quepid/wiki/Judgement-Rating-Best-Practices)
  MARKDOWN
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

  has_many :query_doc_pairs, dependent: :delete_all, autosave: true

  has_many   :judgements,
             through: :query_doc_pairs

  has_many :judges, -> { distinct }, through: :judgements, class_name: 'User', source: :user

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

  # Virtual attribute for form display - allows selecting a scorer to copy scale from
  attr_accessor :scorer_id

  # Transform scale from array to a string
  serialize :scale, coder: ScaleSerializer
  serialize :scale_with_labels, coder: JSON

  after_destroy :delete_attachments

  # Scopes
  include ForUserScope

  scope :active, -> { where(archived: false) }
  scope :archived, -> { where(archived: true) }

  def archive!
    update(archived: true)
  end

  def unarchive!
    update(archived: false)
  end

  # Custom validation to prevent scale changes but allow label changes
  validate :scale_cannot_be_changed_if_judgements_exist

  after_initialize do |book|
    book.scale = [] if book.scale.nil? || (book.scale.respond_to?(:empty?) && book.scale.empty?)
  end

  # Returns the appropriate default scoring guidelines based on the scale size
  def default_scoring_guidelines
    return TWO_POINT_GUIDELINES if 2 == scale&.length
    return FOUR_POINT_GUIDELINES if 4 == scale&.length

    # For other scales, return a generic template
    FOUR_POINT_GUIDELINES
  end

  # Returns the scoring guidelines, falling back to defaults if not set
  def effective_scoring_guidelines
    scoring_guidelines.presence || default_scoring_guidelines
  end

  def scale_list= value
    self.scale = value.split(',') if value.present?
  end

  def scale_list
    # rubocop:disable Style/SafeNavigation
    scale.join(',') unless scale.nil?
    # scale&.join(',')
    # rubocop:enable Style/SafeNavigation
  end

  scope :with_counts, -> {
                        select <<~SQL.squish
                          books.*,
                          (
                            SELECT COUNT(query_doc_pairs.id) FROM query_doc_pairs
                            WHERE book_id = books.id
                          ) AS query_doc_pairs_count
                        SQL
                      }

  def queries_count
    query_doc_pairs.select(:query_text).distinct.count
  end

  # Not proud of this method, but it's the only way I can get the dependent
  # objects of a Book to actually delete!
  # Otherwise our foreign key on judgements to query_doc_pairs gets violated with
  # a book.destroy method.
  def really_destroy
    Judgement.joins(:query_doc_pair)
      .where(query_doc_pairs: { book_id: id })
      .delete_all
    query_doc_pairs.delete_all
    destroy
  end

  private

  # Validates that scale values cannot be changed if judgements exist
  # but allows changing scale_with_labels for the same scale
  def scale_cannot_be_changed_if_judgements_exist
    return unless persisted? && scale_changed?

    # Allow scale changes if no judgements exist yet
    return if judgements.empty?

    # Check if the actual scale values have changed (not just the labels)
    old_scale = scale_was
    new_scale = scale

    # If the scale values themselves have changed, prevent it
    errors.add(:scale, "cannot be changed when judgements exist. Current judgements use scale #{old_scale.inspect}") if old_scale != new_scale
  end

  def delete_attachments
    import_file.purge_later
    export_file.purge_later
  end
end

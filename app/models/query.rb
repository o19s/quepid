# frozen_string_literal: true

# == Schema Information
#
# Table name: queries
#
#  id               :integer          not null, primary key
#  arranged_at      :bigint
#  arranged_next    :bigint
#  information_need :string(255)
#  notes            :text(65535)
#  options          :json
#  query_text       :string(2048)
#  created_at       :datetime         not null
#  updated_at       :datetime         not null
#  case_id          :integer
#
# Indexes
#
#  index_queries_on_case_id  (case_id)
#
# Foreign Keys
#
#  queries_ibfk_1  (case_id => cases.id)
#

require_relative 'concerns/arrangement/item'

class Query < ApplicationRecord
  # Arrangement
  include Arrangement::Item

  # Associations
  belongs_to :case, autosave: true, optional: false, touch: true

  has_many :ratings,
           dependent: :destroy

  has_many :snapshot_queries,
           dependent: :destroy

  # Concerns

  # Validations
  validates :query_text, presence: true, length: { maximum: 2048 }
  validates :options, json_format: true, allow_blank: true

  # Scopes

  scope :has_information_need, -> { where.not(information_need: [ nil, '' ]) }

  # Keys in `options` owned by vectorisation (QueryVectorizer); everything else there
  # belongs to the user.
  VECTOR_OPTION_KEYS = %w[query_vec query_vec_meta query_vec_error].freeze

  # `options` as a Hash. Some older rows hold it as a JSON string.
  def options_hash
    value = options
    value = JSON.parse(value) if value.is_a?(String)
    value.is_a?(Hash) ? value : {}
  rescue JSON::ParserError
    {}
  end

  # @param embedder [Embedder, nil] the case's embedder
  # @return [QueryVectorStatus]
  def vector_status embedder
    opts = options_hash
    QueryVectorStatus.compute(embedder: embedder, query_text: query_text, has_vector: opts.key?('query_vec'),
                              meta: opts['query_vec_meta'], error: opts['query_vec_error'])
  end

  # Merges vectorisation keys into options without touching the user's own keys, and
  # without bumping updated_at: a vector arriving is not the user modifying the query.
  # Pass nil for a key to remove it.
  def write_vector_options changes
    opts = options_hash.merge(changes.stringify_keys)
    opts.compact!
    update_columns(options: opts)
  end

  # Status of every query in the case, keyed by query id, without loading the vectors:
  # only the small metadata keys are read out of `options`.
  # @return [Hash{Integer => QueryVectorStatus}]
  def self.vector_statuses_for kase
    embedder = kase.embedder
    rows = where(case_id: kase.id).pluck(
      :id, :query_text,
      Arel.sql(AdapterFunctions.json_has_key('options', 'query_vec')),
      Arel.sql(AdapterFunctions.json_value('options', 'query_vec_meta')),
      Arel.sql(AdapterFunctions.json_value('options', 'query_vec_error'))
    )
    rows.to_h do |id, text, has_vector, meta, error|
      [ id, QueryVectorStatus.compute(embedder: embedder, query_text: text,
                                      has_vector: ActiveModel::Type::Boolean.new.cast(has_vector),
                                      meta: parse_json_value(meta), error: parse_json_value(error)) ]
    end
  end

  def self.parse_json_value value
    return value if value.nil? || value.is_a?(Hash)

    JSON.parse(value)
  rescue JSON::ParserError
    nil
  end
  private_class_method :parse_json_value

  def parent_list
    self.case.queries
  end

  def list_owner
    self.case
  end
end

# frozen_string_literal: true

# An external API that turns text into a vector embedding (OpenAI, Voyage, Ollama, any
# OpenAI-compatible server). Owned by a user and shared with teams, like a SearchEndpoint.
# What the vendor can do -- request a smaller vector, take an instruction -- comes from
# EmbedderProvider; how to call it from the adapter that provider names.
# == Schema Information
#
# Table name: embedders
#
#  id             :bigint           not null, primary key
#  api_key        :string(4000)
#  archived       :boolean          default(FALSE), not null
#  connection_id  :bigint
#  dimensions     :integer
#  input_template :text(65535)
#  instruction    :text(65535)
#  model          :string(255)      not null
#  name           :string(255)      not null
#  options        :json
#  provider       :string(50)       not null
#  service_url    :string(500)
#  timeout        :integer          default(30), not null
#  truncation     :string(20)       default("none"), not null
#  created_at     :datetime         not null
#  updated_at     :datetime         not null
#  owner_id       :integer
#
# Indexes
#
#  index_embedders_on_connection_id    (connection_id)
#  index_embedders_on_owner_id_and_id  (owner_id,id)
#
class Embedder < ApplicationRecord
  TRUNCATIONS = %w[none native client].freeze

  # The settings that change the vectors produced. The fingerprint covers exactly these,
  # and changing any of them re-vectorises the cases using this embedder. Name, key and
  # timeout don't change the output.
  VECTOR_SETTINGS = %w[provider service_url model dimensions truncation instruction input_template].freeze

  # Shown in the form and the API instead of the key itself.
  MASKED_API_KEY = '******'

  # How many leading vector components a check echoes back -- enough to see it's a real vector.
  CHECK_PREVIEW_SIZE = 5

  # What a check found: the string sent, the vector's size, its first components and how
  # long the provider took, in milliseconds.
  CheckResult = Data.define(:input, :dimensions, :preview, :elapsed_ms)

  # Fields the embedder form and API accept; controllers permit this plus their own extras
  # (e.g. :archived, :team_ids).
  PERMITTED_PARAMS = [ :name, :provider, :service_url, :model, :api_key, :dimensions, :truncation, :instruction, :input_template, :timeout, :connection_id ].freeze

  # too late now!
  # rubocop:disable-next Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_embedders'

  belongs_to :owner, class_name: 'User', optional: true

  # Where to reach the provider and the key to use, kept once for everything that calls it
  # (ADR 0005). Without one the embedder uses its own service_url, api_key and timeout.
  belongs_to :connection, optional: true, inverse_of: :embedders

  # Deleting an embedder unlinks its cases; the vectors already stored on their
  # queries stay, and are recognisably stale by their fingerprint.
  has_many :cases, dependent: :nullify, inverse_of: :embedder

  include ForUserScope

  encrypts :api_key, deterministic: false

  scope :not_archived, -> { where(archived: false) }

  before_validation :take_provider_from_connection
  before_validation :drop_settings_the_provider_ignores
  after_update_commit :revectorize_cases, if: -> { saved_changes.keys.intersect?(VECTOR_SETTINGS + [ 'connection_id' ]) }

  validates :name, presence: true
  validates :provider, inclusion: { in: ->(_) { EmbedderProvider.keys }, message: 'is not a known provider' }
  validates :model, presence: true
  validates :service_url, presence: true, format: { with: %r{\Ahttps?://}i, message: 'must start with http:// or https://' }
  validates :api_key, length: { maximum: 1000 }, allow_blank: true
  validates :truncation, inclusion: { in: TRUNCATIONS }
  validates :dimensions, numericality: { only_integer: true, greater_than: 0 }, allow_nil: true
  validates :dimensions, presence: { message: 'are required to truncate' }, unless: -> { 'none' == truncation }
  validates :timeout, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 600 }
  validate :native_truncation_supported
  validate :connection_fits_and_is_usable
  validate :api_key_present_when_required
  validate :input_template_has_query

  def provider_definition
    @provider_definition ||= EmbedderProvider.find(provider)
  end

  # The provider is the embedder's own choice, and its connection has to be for that provider (a
  # Voyage embedder can't use an Ollama connection). Left blank, it is the connection's.
  def provider
    super.presence || connection&.service
  end

  # With a connection, its URL and timeout are the embedder's; the embedder's own columns are
  # what an embedder without one uses.
  def service_url
    connection ? connection.base_url : super
  end

  def timeout
    connection ? connection.timeout : super
  end

  # The headers a request carries: the connection's (how its key is sent is its own business),
  # or a bearer key for an embedder that keeps its own.
  def request_headers
    return connection.request_headers if connection

    return {} if api_key.blank? || :none == provider_definition.auth_style

    { 'Authorization' => "Bearer #{api_key}" }
  end

  def adapter
    provider_definition.adapter_class.new(self)
  end

  # Vectors for these texts, in order. See EmbedderAdapters::Base#embed.
  def embed texts, timeout: nil
    adapter.embed(Array(texts), timeout: timeout)
  end

  # Embeds one text to see whether the provider, URL, model and key work. Nothing is saved.
  # Raises EmbedderAdapters::Error when the provider can't be reached or refuses.
  def check text
    vector = nil
    elapsed_ms = ActiveSupport::Benchmark.realtime(:float_millisecond) { vector = embed(text).first }

    CheckResult.new(input: render_input(text), dimensions: vector.size, preview: vector.first(CHECK_PREVIEW_SIZE), elapsed_ms: elapsed_ms.round)
  end

  # The string actually sent for a query: wrapped in the input template when there is one,
  # or in the default instruction template when only an instruction is set, else as is.
  def render_input text
    template = input_template.presence || (instruction.present? ? EmbedderProvider::DEFAULT_INPUT_TEMPLATE : nil)
    return text.to_s if template.nil?

    template.gsub('{instruction}') { instruction.to_s }.gsub('{query}') { text.to_s }
  end

  # Changes whenever one of VECTOR_SETTINGS changes; vectors stored with an older
  # fingerprint are stale (see QueryVectorStatus).
  def fingerprint
    Digest::SHA256.hexdigest(VECTOR_SETTINGS.map { |attribute| public_send(attribute).to_s }.to_json)[0, 16]
  end

  # Identifies the exact text sent for a query, so a stored vector can be checked
  # against what would be sent now without calling the API.
  def input_digest text
    Digest::SHA256.hexdigest(render_input(text))[0, 16]
  end

  # Whether a key is set, for the form and the API, which never show the key itself.
  def masked_api_key
    key_set = connection ? connection.secret.present? : api_key.present?
    key_set ? MASKED_API_KEY : ''
  end

  # Cases per embedder for list pages, in one grouped query.
  def self.cases_count_by_embedder_id embedder_ids
    Case.where(embedder_id: embedder_ids).group(:embedder_id).count
  end

  # A blank or masked submitted key means "keep the saved one" -- the form never shows it.
  def self.keep_existing_key? submitted
    submitted.blank? || MASKED_API_KEY == submitted
  end

  def mark_archived!
    update(archived: true)
  end

  private

  # An embedder created from just a connection takes that connection's provider.
  def take_provider_from_connection
    return unless connection && self[:provider].blank?

    self[:provider] = connection.service
    @provider_definition = nil
  end

  def connection_fits_and_is_usable
    return unless connection

    problem = connection_problem
    errors.add(:connection, problem) if problem
  end

  # Why the connection can't be used, or nil. The first thing wrong is the one worth saying.
  def connection_problem
    label = connection.service_definition&.label || connection.service
    return "to #{label} can't make embeddings" unless connection.service_definition&.capabilities&.include?('embeddings')
    return "is for #{label}, not #{provider_definition&.label || provider}" if connection.service != provider

    "isn't one you can use" unless connection_usable_by_owner?
  end

  # An unchanged connection stays allowed, so renaming an embedder never trips over access that
  # was withdrawn later; picking a new one needs the owner to be able to use it.
  def connection_usable_by_owner?
    !connection_id_changed? || owner&.connections_involved_with&.exists?(id: connection_id)
  end

  def revectorize_cases
    cases.find_each { |kase| VectorizeCaseQueriesJob.enqueue_for(kase) }
  end

  # The form posts every field whatever the provider; drop what this provider can't use so a
  # setting left over from another provider isn't silently stored -- or silently sent.
  def drop_settings_the_provider_ignores
    self.truncation = 'none' if truncation.blank?
    self.dimensions = nil if 'none' == truncation

    definition = provider_definition
    return if definition.nil?

    return if definition.supports_instructions?

    self.instruction = nil
    self.input_template = nil
  end

  def native_truncation_supported
    return unless 'native' == truncation

    definition = provider_definition
    return if definition.nil?

    unless definition.supports_dimensions?
      errors.add(:truncation, "native is not supported by #{definition.label}; use client-side truncation")
      return
    end

    allowed = definition.allowed_dimensions
    return if allowed.empty? || dimensions.nil? || allowed.include?(dimensions)

    errors.add(:dimensions, "must be one of #{allowed.to_sentence(two_words_connector: ' or ', last_word_connector: ' or ')} for #{definition.label}")
  end

  def api_key_present_when_required
    definition = provider_definition
    return if connection || definition.nil? || !definition.requires_key? || api_key.present?

    errors.add(:api_key, "is required for #{definition.label}")
  end

  def input_template_has_query
    return if input_template.blank? || input_template.include?('{query}')

    errors.add(:input_template, 'must contain {query}')
  end
end

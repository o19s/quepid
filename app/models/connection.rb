# frozen_string_literal: true

# How to reach one external service and authenticate to it (OpenAI, Voyage, Ollama, Elasticsearch,
# ...): a URL, how the secret is sent and the secret itself. It says nothing about what the service
# is used for; what a service can do is in ConnectionService, and the settings that belong to one
# task (a model, a prompt, a vector size) stay on the thing that does the task. See ADR 0005.
#
# Owned by a user and shared with teams, like a SearchEndpoint or Embedder. Using a connection
# spends its owner's secret, so only the owner can change it -- someone it is shared with can use
# it but never read it, and can't point it at a server of their own. A connection with no owner is
# instance-wide: everyone can use it and administrators manage it.
# == Schema Information
#
# Table name: connections
#
#  id                  :bigint           not null, primary key
#  archived            :boolean          default(FALSE), not null
#  auth_header         :string(100)
#  auth_scheme         :string(20)       default("bearer"), not null
#  base_url            :string(500)
#  extra_headers       :json
#  name                :string(255)      not null
#  options             :json
#  requests_per_minute :integer          default(0), not null
#  secret              :string(4000)
#  service             :string(50)       not null
#  timeout             :integer          default(30), not null
#  created_at          :datetime         not null
#  updated_at          :datetime         not null
#  owner_id            :integer
#
# Indexes
#
#  index_connections_on_owner_id_and_id  (owner_id,id)
#
class Connection < ApplicationRecord
  # none: nothing; bearer: "Authorization: Bearer <secret>"; basic: "Authorization: Basic" with
  # the secret as user:password; apikey: "Authorization: ApiKey <secret>"; header: the secret in
  # the header named by auth_header.
  AUTH_SCHEMES = %w[none bearer basic apikey header].freeze

  AUTH_SCHEME_LABELS = {
    'none'   => 'None',
    'bearer' => 'Bearer token',
    'basic'  => 'Basic (user:password)',
    'apikey' => 'ApiKey (Authorization: ApiKey …)',
    'header' => 'Custom header',
  }.freeze

  # Shown in the form and the API instead of the secret itself.
  MASKED_SECRET = '******'

  # Fields the connection form accepts; the controller permits these plus :team_ids.
  PERMITTED_PARAMS = [ :name, :service, :base_url, :auth_scheme, :auth_header, :secret, :timeout,
                       :requests_per_minute, :api_version, :extra_headers_text ].freeze

  # What a check found. status is :ok (the service accepted the credentials), :reachable (it
  # answered, but the check can't tell whether the credentials work), :rejected (401 or 403) or
  # :unreachable (no answer). http_status is nil for the last.
  CheckResult = Data.define(:status, :http_status, :message, :elapsed_ms)

  # too late now!
  # rubocop:disable-next Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams, join_table: 'teams_connections'

  belongs_to :owner, class_name: 'User', optional: true

  # Deleting a connection unlinks the embedders on it; the UI refuses to while any use it.
  has_many :embedders, dependent: :nullify, inverse_of: :connection

  include ForUserScope

  encrypts :secret, deterministic: false

  scope :not_archived, -> { where(archived: false) }

  before_validation :default_name
  before_validation :drop_settings_the_scheme_ignores
  before_validation :normalise_base_url
  after_update :sync_embedder_providers, if: :saved_change_to_service?
  after_update_commit :revectorize_embedder_cases, if: -> { saved_changes.keys.intersect?(%w[service base_url]) }

  validates :name, presence: true
  validates :service, inclusion: { in: ->(_) { ConnectionService.keys }, message: 'is not a known service' }
  validates :base_url, presence: true, format: { with: %r{\Ahttps?://}i, message: 'must start with http:// or https://' }
  validates :auth_scheme, inclusion: { in: AUTH_SCHEMES }
  validates :auth_header, presence: true, format: { with: /\A[A-Za-z0-9-]+\z/, message: 'must be a valid header name' }, if: -> { 'header' == auth_scheme }
  validates :secret, length: { maximum: 1000 }, allow_blank: true
  validates :timeout, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 600 }
  validates :requests_per_minute, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100_000 }
  validate :secret_present_when_required
  validate :basic_secret_has_user_and_password
  validate :extra_headers_are_a_flat_object
  validate :service_still_makes_embeddings, on: :update

  # Every connection the user may use: their own, those shared with a team of theirs, and the
  # instance-wide ones. Creating or changing one is narrower: see #manageable_by?.
  def self.usable_by user
    where(id: for_user(user).select(:id)).or(where(owner_id: nil))
  end

  def service_definition
    return @service_definition if @service_definition&.key == service

    @service_definition = ConnectionService.find(service)
  end

  def instance_wide?
    owner_id.nil?
  end

  # The owner changes a connection; so does an administrator for an instance-wide one.
  def manageable_by? user
    return false if user.nil?

    instance_wide? ? user.administrator? : owner_id == user.id
  end

  def masked_secret
    return '' if secret.blank?
    return "#{secret.split(':', 2).first}:#{MASKED_SECRET}" if 'basic' == auth_scheme && secret.include?(':')

    MASKED_SECRET
  end

  # A blank or masked submitted secret means "keep the saved one" -- the form never shows it.
  def self.keep_existing_secret? submitted
    submitted.blank? || MASKED_SECRET == submitted || submitted.to_s.end_with?(":#{MASKED_SECRET}")
  end

  # The API version for services that take one (Azure), kept in options.
  def api_version
    options&.dig('api_version')
  end

  def api_version= value
    self.options = (options || {}).merge('api_version' => value.presence).compact
  end

  # extra_headers as the form edits them: one "Name: value" per line.
  def extra_headers_text
    (extra_headers || {}).map { |name, value| "#{name}: #{value}" }.join("\n")
  end

  def extra_headers_text= text
    @extra_headers_text_error = nil
    self.extra_headers = parse_header_lines(text.to_s)
  end

  # The headers every request carries: the extra headers, then the ones that send the secret.
  def request_headers
    (extra_headers || {}).to_h.merge(auth_headers)
  end

  # Asks the service something cheap to see whether the URL and the secret work. Never raises:
  # a service that can't be reached is a result, not an error. Nothing is saved.
  def check
    path = service_definition&.check_path
    response = nil
    elapsed_ms = ActiveSupport::Benchmark.realtime(:float_millisecond) { response = check_request(path) }

    interpret_check(response, path, elapsed_ms.round)
  rescue Faraday::Error => e
    CheckResult.new(status: :unreachable, http_status: nil, message: "Could not reach #{base_url}: #{e.message}", elapsed_ms: nil)
  end

  def mark_archived!
    update(archived: true)
  end

  private

  def auth_headers
    return {} if secret.blank?

    case auth_scheme
    when 'bearer' then { 'Authorization' => "Bearer #{secret}" }
    when 'basic' then { 'Authorization' => "Basic #{Base64.strict_encode64(secret)}" }
    when 'apikey' then { 'Authorization' => "ApiKey #{secret}" }
    when 'header' then { auth_header => secret }
    else {}
    end
  end

  def check_request path
    client = LlmConnection.build(url: base_url, retry_options: { max: 0 })
    client.get(path.to_s) do |req|
      req.headers.merge!(service_definition&.check_headers.to_h).merge!(request_headers)
      req.options.timeout = timeout.to_i
    end
  end

  def interpret_check response, path, elapsed_ms
    status = response.status
    return CheckResult.new(status: :rejected, http_status: status, message: "#{service_definition&.label || service} rejected the credentials (HTTP #{status}).", elapsed_ms: elapsed_ms) if [ 401, 403 ].include?(status)
    return CheckResult.new(status: :ok, http_status: status, message: "Connected: #{path.presence || 'the root'} answered with HTTP #{status}.", elapsed_ms: elapsed_ms) if path && response.success?

    reachable = path ? "#{path} answered with HTTP #{status}" : "The server answered with HTTP #{status}"
    CheckResult.new(status: :reachable, http_status: status,
                    message: "#{reachable}. The server is reachable, but this can't confirm the credentials work.",
                    elapsed_ms: elapsed_ms)
  end

  # Settings that don't apply to the scheme are dropped, so one left over from another scheme
  # isn't silently stored or sent.
  # A different service is a different embedding provider, so the embedders on this connection
  # follow it (a Voyage connection switched to Cohere makes them Cohere embedders).
  def sync_embedder_providers
    embedders.update_all(provider: service)
  end

  # Where the vectors come from changed, so what the embedders' cases hold is stale.
  def revectorize_embedder_cases
    embedders.find_each do |embedder|
      embedder.cases.find_each { |kase| VectorizeCaseQueriesJob.enqueue_for(kase) }
    end
  end

  def service_still_makes_embeddings
    return unless service_changed? && embedders.exists?
    return if ConnectionService.find(service)&.capabilities&.include?('embeddings')

    errors.add(:service, "can't make embeddings, and embedders use this connection")
  end

  # A connection left unnamed is called after its service: "OpenAI Connection".
  def default_name
    return if name.present? || service_definition.nil?

    self.name = "#{service_definition.label} Connection"
  end

  def drop_settings_the_scheme_ignores
    self.auth_header = nil unless 'header' == auth_scheme
    self.secret = nil if 'none' == auth_scheme
  end

  def normalise_base_url
    self.base_url = base_url.to_s.strip.chomp('/') if base_url.present?
  end

  def secret_present_when_required
    definition = service_definition
    return if definition.nil? || !definition.requires_secret? || 'none' == auth_scheme || secret.present?

    errors.add(:secret, "is required for #{definition.label}")
  end

  def basic_secret_has_user_and_password
    return unless 'basic' == auth_scheme && secret.present?

    errors.add(:secret, 'must be in user:password format for basic auth') unless secret.include?(':')
  end

  def extra_headers_are_a_flat_object
    errors.add(:extra_headers_text, @extra_headers_text_error) if @extra_headers_text_error
    return if extra_headers.blank? || (extra_headers.is_a?(Hash) && extra_headers.values.all?(String))

    errors.add(:extra_headers, 'must be header names with text values')
  end

  def parse_header_lines text
    text.each_line.filter_map do |line|
      next if line.strip.empty?

      name, value = line.split(':', 2).map(&:strip)
      if name.blank? || value.nil?
        @extra_headers_text_error = "line \"#{line.strip}\" must look like Name: value"
        next
      end
      [ name, value ]
    end.to_h
  end
end

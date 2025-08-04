# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "search_endpoints"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb3"
# collation = "utf8mb3_general_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "name", type = "string", nullable = true },
#   { name = "owner_id", type = "integer", nullable = true },
#   { name = "search_engine", type = "string", nullable = true },
#   { name = "endpoint_url", type = "string", nullable = true },
#   { name = "api_method", type = "string", nullable = true },
#   { name = "custom_headers", type = "string", nullable = true },
#   { name = "archived", type = "boolean", nullable = true, default = "0" },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "basic_auth_credential", type = "string", nullable = true },
#   { name = "mapper_code", type = "text", nullable = true },
#   { name = "proxy_requests", type = "boolean", nullable = true, default = "0" },
#   { name = "options", type = "json", nullable = true }
# ]
#
# indexes = [
#   { name = "index_search_endpoints_on_owner_id_and_id", columns = ["owner_id", "id"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'owner_id' referencing 'users'
# - Association 'tries' has N+1 query risk. Consider using includes/preload
# - Column 'name' should probably have NOT NULL constraint
# - Column 'search_engine' should probably have NOT NULL constraint
# - Column 'endpoint_url' should probably have NOT NULL constraint
# - Column 'api_method' should probably have NOT NULL constraint
# - Column 'custom_headers' should probably have NOT NULL constraint
# - Column 'archived' should probably have NOT NULL constraint
# - Column 'basic_auth_credential' should probably have NOT NULL constraint
# - Column 'mapper_code' should probably have NOT NULL constraint
# - Column 'proxy_requests' should probably have NOT NULL constraint
# - Column 'options' should probably have NOT NULL constraint
# - Column 'mapper_code' is commonly used in queries - consider adding an index
# <rails-lens:schema:end>
class SearchEndpoint < ApplicationRecord
  # Associations
  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table: 'teams_search_endpoints'
  # rubocop:enable Rails/HasAndBelongsToMany

  belongs_to :owner,
             class_name: 'User', optional: true

  has_many   :tries, dependent: :nullify, inverse_of: :search_endpoint

  # Scopes
  include ForUserScope

  scope :not_archived, -> { where('`search_endpoints`.`archived` = false') }

  after_initialize do |se|
    se.archived = false if se.archived.nil?
  end

  # Validations
  validates :search_engine, presence: true
  validates :endpoint_url, presence: true
  validates :api_method, presence: true
  validate :validate_proxy_requests_api_method

  def fullname
    name.presence || middle_truncate("#{search_engine.titleize} #{endpoint_url}")
  end

  def mark_archived
    self.archived = true
  end

  def mark_archived!
    mark_archived
    save
  end

  private

  def middle_truncate str, total: 30, lead: 15, trail: 15
    str.truncate(total, omission: "#{str.first(lead)}...#{str.last(trail)}")
  end

  def validate_proxy_requests_api_method
    errors.add(:api_method, 'cannot be JSONP when proxy_request is enabled') if proxy_requests? && 'JSONP' == api_method
  end
end

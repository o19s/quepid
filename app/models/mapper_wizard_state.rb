# frozen_string_literal: true

# == Schema Information
#
# Table name: mapper_wizard_states
#
#  id                       :bigint           not null, primary key
#  custom_headers           :text(65535)
#  docs_mapper              :text(65535)
#  html_content             :text(16777215)
#  http_method              :string(10)       default("GET")
#  number_of_results_mapper :text(65535)
#  query_params             :string(255)
#  request_body             :text(65535)
#  search_url               :string(2000)
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#  user_id                  :integer          not null
#
# Indexes
#
#  index_mapper_wizard_states_on_created_at  (created_at)
#  index_mapper_wizard_states_on_user_id     (user_id)
#
# Foreign Keys
#
#  fk_rails_...  (user_id => users.id)
#
class MapperWizardState < ApplicationRecord
  belongs_to :user

  validates :search_url, length: { maximum: 2000 }
  validates :http_method, inclusion: { in: %w[GET POST], allow_blank: true }

  # Find or create a wizard state for a user
  # Each user should only have one active wizard state at a time
  def self.find_or_create_for_user user
    find_or_create_by!(user: user)
  end

  # Store HTML content from a fetched URL
  # query_params is stored separately so it can be changed without affecting the base search_url
  # custom_headers stores JSON string of headers to send with the request
  def store_fetch_result url, html, method: 'GET', body: nil, query_params: nil, custom_headers: nil
    update!(
      search_url:     url,
      html_content:   html,
      http_method:    method,
      request_body:   body,
      query_params:   query_params,
      custom_headers: custom_headers
    )
  end

  # Store generated mapper code
  def store_mappers number_of_results_mapper:, docs_mapper:
    update!(
      number_of_results_mapper: number_of_results_mapper,
      docs_mapper:              docs_mapper
    )
  end
end

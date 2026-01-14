# frozen_string_literal: true

# == Schema Information
#
# Table name: mapper_wizard_states
#
#  id                       :bigint           not null, primary key
#  basic_auth_credential    :string(255)
#  custom_headers           :text(65535)
#  docs_mapper              :text(65535)
#  html_content             :text(16777215)
#  http_method              :string(10)       default("GET")
#  number_of_results_mapper :text(65535)
#  search_url               :string(2000)
#  test_query               :text(65535)
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

  # rubocop:disable Metrics/ParameterLists
  # Store HTML content from a fetched URL
  # test_query stores either query params (for GET) or JSON body (for POST)
  # custom_headers stores JSON string of headers to send with the request
  # basic_auth_credential stores credentials in format "username:password"
  def store_fetch_result url, html, method: 'GET', test_query: nil, custom_headers: nil, basic_auth_credential: nil
    update!(
      search_url:            url,
      html_content:          html,
      http_method:           method,
      test_query:            test_query,
      custom_headers:        custom_headers,
      basic_auth_credential: basic_auth_credential
    )
  end
  # rubocop:enable Metrics/ParameterLists

  # Store generated mapper code
  def store_mappers number_of_results_mapper:, docs_mapper:
    update!(
      number_of_results_mapper: number_of_results_mapper,
      docs_mapper:              docs_mapper
    )
  end
end

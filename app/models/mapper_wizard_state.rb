# frozen_string_literal: true

# == Schema Information
#
# Table name: mapper_wizard_states
#
#  id                       :bigint           not null, primary key
#  docs_mapper              :text(65535)
#  html_content             :text(16777215)
#  http_method              :string(10)       default("GET")
#  number_of_results_mapper :text(65535)
#  query_params             :string(255)
#  request_body             :text(65535)
#  search_url               :string(2000)
#  created_at               :datetime         not null
#  updated_at               :datetime         not null
#  user_id                  :integer
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
  belongs_to :user, optional: true

  validates :search_url, length: { maximum: 2000 }
  validates :http_method, inclusion: { in: %w[GET POST], allow_blank: true }

  # Find or create a wizard state for a user
  # Each user should only have one active wizard state at a time
  def self.find_or_create_for_user user
    return create! if user.nil?

    find_or_create_by!(user: user)
  end

  # Get the current wizard state for a user, or nil if none exists
  def self.current_for_user user
    return nil if user.nil?

    find_by(user: user)
  end

  # Clean up old wizard states
  def self.cleanup_old_states older_than = 1.day.ago
    where(created_at: ...older_than).delete_all
  end

  # Store HTML content from a fetched URL
  # query_params is stored separately so it can be changed without affecting the base search_url
  def store_fetch_result url, html, method: 'GET', body: nil, query_params: nil
    update!(
      search_url:   url,
      html_content: html,
      http_method:  method,
      request_body: body,
      query_params: query_params
    )
  end

  # Build the full URL with query params appended (for fetching/testing)
  def full_fetch_url
    return search_url if query_params.blank?

    separator = search_url.include?('?') ? '&' : '?'
    "#{search_url}#{separator}#{query_params}"
  end

  # Store generated mapper code
  def store_mappers number_of_results_mapper:, docs_mapper:
    update!(
      number_of_results_mapper: number_of_results_mapper,
      docs_mapper:              docs_mapper
    )
  end

  # Clear all wizard state for starting fresh
  def clear!
    update!(
      search_url:               nil,
      http_method:              'GET',
      request_body:             nil,
      html_content:             nil,
      number_of_results_mapper: nil,
      docs_mapper:              nil
    )
  end
end

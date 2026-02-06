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
require 'test_helper'
require 'support/shared_examples/custom_headers_validatable_examples'

class MapperWizardStateTest < ActiveSupport::TestCase
  include CustomHeadersValidatableExamples

  let(:user) { users(:random) }

  describe 'basic validations' do
    it 'requires a user' do
      wizard_state = MapperWizardState.new
      assert_not wizard_state.valid?
      assert_includes wizard_state.errors[:user], 'must exist'
    end

    it 'validates search_url length' do
      wizard_state = MapperWizardState.new(user: user, search_url: 'a' * 2001)
      assert_not wizard_state.valid?
      assert_includes wizard_state.errors[:search_url], 'is too long (maximum is 2000 characters)'
    end

    it 'validates http_method inclusion' do
      wizard_state = MapperWizardState.new(user: user, http_method: 'DELETE')
      assert_not wizard_state.valid?
      assert_includes wizard_state.errors[:http_method], 'is not included in the list'
    end
  end

  describe 'find_or_create_for_user' do
    it 'creates a new wizard state if none exists' do
      assert_difference 'MapperWizardState.count', 1 do
        wizard_state = MapperWizardState.find_or_create_for_user(user)
        assert_predicate wizard_state, :persisted?
        assert_equal user, wizard_state.user
      end
    end

    it 'returns existing wizard state if one exists' do
      existing = MapperWizardState.create!(user: user)

      assert_no_difference 'MapperWizardState.count' do
        wizard_state = MapperWizardState.find_or_create_for_user(user)
        assert_equal existing.id, wizard_state.id
      end
    end
  end

  describe 'store_fetch_result' do
    let(:wizard_state) { MapperWizardState.create!(user: user) }

    it 'stores fetch result with all parameters' do
      wizard_state.store_fetch_result(
        'https://example.com/search',
        '<html>response</html>',
        method:                'POST',
        test_query:            '{"query": "test"}',
        custom_headers:        { 'Authorization' => 'Bearer token' },
        basic_auth_credential: 'user:pass'
      )

      wizard_state.reload
      assert_equal 'https://example.com/search', wizard_state.search_url
      assert_equal '<html>response</html>', wizard_state.html_content
      assert_equal 'POST', wizard_state.http_method
      assert_equal '{"query": "test"}', wizard_state.test_query
      assert_equal({ 'Authorization' => 'Bearer token' }, wizard_state.custom_headers)
      assert_equal 'user:pass', wizard_state.basic_auth_credential
    end

    it 'stores fetch result with minimal parameters' do
      wizard_state.store_fetch_result(
        'https://example.com/search',
        '<html>response</html>'
      )

      wizard_state.reload
      assert_equal 'https://example.com/search', wizard_state.search_url
      assert_equal '<html>response</html>', wizard_state.html_content
      assert_equal 'GET', wizard_state.http_method
      assert_nil wizard_state.test_query
      assert_nil wizard_state.custom_headers
      assert_nil wizard_state.basic_auth_credential
    end
  end

  describe 'store_mappers' do
    let(:wizard_state) { MapperWizardState.create!(user: user) }

    it 'stores mapper code' do
      wizard_state.store_mappers(
        number_of_results_mapper: 'function() { return 100; }',
        docs_mapper:              'function() { return []; }'
      )

      wizard_state.reload
      assert_equal 'function() { return 100; }', wizard_state.number_of_results_mapper
      assert_equal 'function() { return []; }', wizard_state.docs_mapper
    end
  end

  # Helper method for shared examples
  def create_record_with_custom_headers custom_headers
    MapperWizardState.new(
      user:           user,
      search_url:     'http://test.example.com',
      custom_headers: custom_headers
    )
  end

  # MapperWizardState-specific tests
  describe 'custom_headers with store_fetch_result' do
    it 'handles validation in store_fetch_result' do
      wizard_state = MapperWizardState.create!(user: user)

      assert_raises(ActiveRecord::RecordInvalid) do
        wizard_state.store_fetch_result(
          'https://example.com',
          '<html>test</html>',
          custom_headers: '{"invalid": json}'
        )
      end
    end

    it 'normalizes in store_fetch_result' do
      wizard_state = MapperWizardState.create!(user: user)
      wizard_state.store_fetch_result(
        'https://example.com',
        '<html>test</html>',
        custom_headers: { 'X-Retry' => 3, 'X-Debug' => true }
      )
      wizard_state.reload
      assert_equal '3', wizard_state.custom_headers['X-Retry']
      assert_equal 'true', wizard_state.custom_headers['X-Debug']
    end
  end
end

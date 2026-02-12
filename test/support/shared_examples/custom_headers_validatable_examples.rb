# frozen_string_literal: true

# Shared test examples for models that include CustomHeadersValidatable
#
# Usage in test files:
#   require 'test_helper'
#   require 'support/shared_examples/custom_headers_validatable_examples'
#
#   class SearchEndpointTest < ActiveSupport::TestCase
#     include CustomHeadersValidatableExamples
#
#     def create_record_with_custom_headers(custom_headers)
#       SearchEndpoint.new(
#         name: 'Test',
#         endpoint_url: 'http://test.com',
#         search_engine: 'solr',
#         api_method: 'GET',
#         custom_headers: custom_headers
#       )
#     end
#   end
#
module CustomHeadersValidatableExamples
  extend ActiveSupport::Concern

  included do
    describe 'custom_headers validation (shared)' do
      it 'accepts valid JSON hash' do
        record = create_record_with_custom_headers({ 'Authorization' => 'Bearer token', 'X-API-Key' => 'key123' })
        assert_predicate record, :valid?
      end

      it 'accepts valid JSON string' do
        record = create_record_with_custom_headers('{"Authorization": "Bearer token", "X-API-Key": "key123"}')
        assert_predicate record, :valid?
      end

      it 'accepts nil custom_headers' do
        record = create_record_with_custom_headers(nil)
        assert_predicate record, :valid?
      end

      it 'accepts empty hash custom_headers' do
        record = create_record_with_custom_headers({})
        assert_predicate record, :valid?
      end

      it 'accepts empty string custom_headers' do
        record = create_record_with_custom_headers('')
        assert_predicate record, :valid?
      end

      it 'rejects invalid JSON string' do
        record = create_record_with_custom_headers('{"invalid": json}')
        assert_not record.valid?
        assert_includes record.errors[:custom_headers].first, 'must be valid JSON'
      end

      it 'rejects JSON array instead of object' do
        record = create_record_with_custom_headers('["header1", "header2"]')
        assert_not record.valid?
        assert_includes record.errors[:custom_headers].first, 'must be a JSON object'
      end

      it 'rejects JSON primitive instead of object' do
        record = create_record_with_custom_headers('"just a string"')
        assert_not record.valid?
        assert_includes record.errors[:custom_headers].first, 'must be a JSON object'
      end

      it 'rejects malformed JSON with missing quotes' do
        record = create_record_with_custom_headers('{Authorization: Bearer token}')
        assert_not record.valid?
        assert_includes record.errors[:custom_headers].first, 'must be valid JSON'
      end

      it 'rejects malformed JSON with trailing comma' do
        record = create_record_with_custom_headers('{"Authorization": "Bearer token",}')
        assert_not record.valid?
        assert_includes record.errors[:custom_headers].first, 'must be valid JSON'
      end
    end

    describe 'custom_headers value normalization (shared)' do
      it 'converts integer header values to strings' do
        record = create_record_with_custom_headers({ 'X-Retry-Count' => 3, 'X-Version' => 42 })
        assert_predicate record, :valid?
        assert_equal '3', record.custom_headers['X-Retry-Count']
        assert_equal '42', record.custom_headers['X-Version']
      end

      it 'converts boolean header values to strings' do
        record = create_record_with_custom_headers({ 'X-Debug' => true, 'X-Enabled' => false })
        assert_predicate record, :valid?
        assert_equal 'true', record.custom_headers['X-Debug']
        assert_equal 'false', record.custom_headers['X-Enabled']
      end

      it 'converts float header values to strings' do
        record = create_record_with_custom_headers({ 'X-Rate' => 1.5, 'X-Percentage' => 99.9 })
        assert_predicate record, :valid?
        assert_equal '1.5', record.custom_headers['X-Rate']
        assert_equal '99.9', record.custom_headers['X-Percentage']
      end

      it 'converts nil header values to strings' do
        record = create_record_with_custom_headers({ 'X-Optional' => nil })
        assert_predicate record, :valid?
        assert_equal '', record.custom_headers['X-Optional']
      end

      it 'converts array header values to comma-separated strings' do
        record = create_record_with_custom_headers({ 'Accept' => [ 'text/html', 'application/json' ] })
        assert_predicate record, :valid?
        assert_equal 'text/html, application/json', record.custom_headers['Accept']
      end

      it 'leaves string header values unchanged' do
        record = create_record_with_custom_headers({ 'Authorization' => 'Bearer token123' })
        assert_predicate record, :valid?
        assert_equal 'Bearer token123', record.custom_headers['Authorization']
      end

      it 'normalizes mixed type headers from JSON string' do
        record = create_record_with_custom_headers('{"X-Count": 5, "X-Debug": true, "Authorization": "Bearer token"}')
        assert_predicate record, :valid?
        assert_equal '5', record.custom_headers['X-Count']
        assert_equal 'true', record.custom_headers['X-Debug']
        assert_equal 'Bearer token', record.custom_headers['Authorization']
      end
    end
  end
end

# frozen_string_literal: true

# Shared test examples for models that include JsonOptionsValidatable
#
# Usage in test files:
#   require 'test_helper'
#   require 'support/shared_examples/json_options_validatable_examples'
#
#   class CaseTest < ActiveSupport::TestCase
#     include JsonOptionsValidatableExamples
#
#     def create_record_with_options(options)
#       Case.new(
#         case_name: 'Test',
#         options: options
#       )
#     end
#   end
#
module JsonOptionsValidatableExamples
  extend ActiveSupport::Concern

  included do
    describe 'options validation (shared)' do
      it 'accepts valid JSON hash' do
        record = create_record_with_options({ 'key' => 'value', 'number' => 123 })
        assert_predicate record, :valid?
      end

      it 'accepts valid JSON string' do
        record = create_record_with_options('{"key": "value", "number": 123}')
        assert_predicate record, :valid?
      end

      it 'accepts nil options' do
        record = create_record_with_options(nil)
        assert_predicate record, :valid?
      end

      it 'accepts empty string options' do
        record = create_record_with_options('')
        assert_predicate record, :valid?
      end

      it 'accepts blank string options' do
        record = create_record_with_options('   ')
        assert_predicate record, :valid?
      end

      it 'accepts empty hash options' do
        record = create_record_with_options({})
        assert_predicate record, :valid?
      end

      it 'accepts nested JSON structures' do
        record = create_record_with_options({ 'nested' => { 'deep' => { 'value' => 123 } } })
        assert_predicate record, :valid?
      end

      it 'accepts single line string' do
        record = create_record_with_options('{"Authorization": "Bearer vespa_cloud_jR5ED6pbyseUaXtOFMVlUIOTj2qCCvwDUBmAftVVVMW"}')
        assert_predicate record, :valid?
      end

      it 'rejects JSON arrays (must be objects)' do
        record = create_record_with_options(%w[item1 item2])
        assert_not record.valid?
        assert_match(/must be a JSON object/, record.errors[:options].first)
      end

      it 'rejects invalid JSON string' do
        record = create_record_with_options('{invalid json}')
        assert_not record.valid?
        assert_match(/must be valid JSON/, record.errors[:options].first)
      end

      it 'rejects malformed JSON with missing quotes' do
        record = create_record_with_options('{key: value}')
        assert_not record.valid?
        assert_match(/must be valid JSON/, record.errors[:options].first)
      end

      it 'rejects malformed JSON with trailing comma' do
        record = create_record_with_options('{"key": "value",}')
        assert_not record.valid?
        assert_match(/must be valid JSON/, record.errors[:options].first)
      end
    end
  end
end

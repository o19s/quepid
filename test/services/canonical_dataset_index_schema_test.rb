# frozen_string_literal: true

require 'test_helper'

class CanonicalDatasetIndexSchemaTest < ActiveSupport::TestCase
  test 'has the id and the seven fields a dataset fills in' do
    assert_equal %w[id title description thumb brand price rating category], CanonicalDatasetIndexSchema::FIELDS.map(&:name)
    assert_equal %w[title description thumb brand price rating category], CanonicalDatasetIndexSchema.mappable_fields.map(&:name)
  end

  test 'says which fields hold a list, a number, or a link' do
    assert CanonicalDatasetIndexSchema.field(:category).multi
    assert_equal :number, CanonicalDatasetIndexSchema.field('price').type
    assert_equal :url, CanonicalDatasetIndexSchema.field('thumb').type
    assert_nil CanonicalDatasetIndexSchema.field('nope')
  end

  test 'has no place for source fields nobody mapped' do
    assert_not_includes CanonicalDatasetIndexSchema::FIELDS.map(&:name), 'attributes'
  end
end

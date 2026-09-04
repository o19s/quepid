# frozen_string_literal: true

require 'test_helper'

class AdapterFunctionsTest < ActiveSupport::TestCase
  describe 'adapter' do
    it 'recognises whichever adapter the suite is running against' do
      assert_includes [ :mysql, :postgresql, :sqlite ], AdapterFunctions.adapter
    end

    it 'maps exactly the adapters Quepid supports' do
      assert_equal %w[Mysql2 PostgreSQL SQLite].sort, AdapterFunctions::ADAPTERS.keys.sort
    end

    it 'raises rather than guessing for an adapter it does not know' do
      assert_raises KeyError do
        AdapterFunctions::ADAPTERS.fetch('Firebird')
      end
    end
  end

  # These are not interchangeable spellings: an expression built for the wrong
  # adapter still parses and still returns numbers, it just returns the wrong
  # ones. SelectionStrategy's weighted sampling silently flattens if either the
  # uniform draw or the log base is wrong for the connection.
  describe 'SQL function names' do
    it 'names a random function the current adapter understands' do
      expected = AdapterFunctions.mysql? ? 'RAND()' : 'RANDOM()'

      assert_equal expected, AdapterFunctions.random_function
    end

    it 'gives a uniform draw in [0, 1) for the current adapter' do
      case AdapterFunctions.adapter
      when :mysql      then assert_equal 'RAND()', AdapterFunctions.uniform_random
      when :postgresql then assert_equal 'RANDOM()', AdapterFunctions.uniform_random
      when :sqlite     then assert_includes AdapterFunctions.uniform_random, '9223372036854775807.0'
      end
    end

    it 'names natural log LOG on MySQL and LN elsewhere' do
      expected = AdapterFunctions.mysql? ? 'LOG' : 'LN'

      assert_equal expected, AdapterFunctions.natural_log
    end

    it 'produces a uniform draw the database actually evaluates to a fraction' do
      value = ActiveRecord::Base.connection
        .select_value("SELECT #{AdapterFunctions.uniform_random}")
        .to_f

      assert_operator value, :>=, 0.0
      assert_operator value, :<, 1.0
    end
  end
end

# frozen_string_literal: true

require 'test_helper'

class AdapterFunctionsTest < ActiveSupport::TestCase
  cover 'AdapterFunctions*'

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
      when :sqlite     then assert_includes AdapterFunctions.uniform_random, '9223372036854775808.0'
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

  # The suite only ever runs against one adapter, so fake the connection's adapter name to
  # pin every adapter's spelling and the unknown-adapter failure.
  describe 'for each supported adapter' do
    expectations = {
      'Mysql2'     => { adapter: :mysql, mysql: true, random: 'RAND()', uniform: 'RAND()', log: 'LOG' },
      'PostgreSQL' => { adapter: :postgresql, mysql: false, random: 'RANDOM()', uniform: 'RANDOM()', log: 'LN' },
      'SQLite'     => { adapter: :sqlite, mysql: false, random: 'RANDOM()',
                        uniform: '((RANDOM() & 9223372036854775807) / 9223372036854775808.0)', log: 'LN' },
    }

    expectations.each do |name, expected|
      it "spells #{name} functions" do
        with_adapter_name(name) do
          assert_equal expected[:adapter], AdapterFunctions.adapter
          assert_equal expected[:mysql], AdapterFunctions.mysql?
          assert_equal expected[:random], AdapterFunctions.random_function
          assert_equal expected[:uniform], AdapterFunctions.uniform_random
          assert_equal expected[:log], AdapterFunctions.natural_log
        end
      end
    end

    it 'raises UnsupportedAdapterError naming the adapter instead of guessing' do
      with_adapter_name('Firebird') do
        error = assert_raises(AdapterFunctions::UnsupportedAdapterError) { AdapterFunctions.adapter }

        assert_equal 'no SQL function mapping for adapter "Firebird" - see lib/adapter_functions.rb', error.message
        assert_raises(AdapterFunctions::UnsupportedAdapterError) { AdapterFunctions.random_function }
      end
    end
  end

  private

  def with_adapter_name name
    connection = ActiveRecord::Base.connection
    connection.define_singleton_method(:adapter_name) { name }
    yield
  ensure
    connection.singleton_class.send(:remove_method, :adapter_name)
  end
end

# frozen_string_literal: true

# Quepid runs against MySQL, PostgreSQL or SQLite (see config/database.yml),
# and a few queries need SQL functions the three spell differently. Kept as one
# shared lookup rather than repeating the connection check at each call site.
#
# Note these differences are silent, not loud: an expression built for the wrong
# adapter still parses and still returns numbers, it just returns the wrong
# ones. So the dispatch raises on an adapter it does not know rather than
# guessing.
module AdapterFunctions
  class UnsupportedAdapterError < StandardError; end

  ADAPTERS = {
    'Mysql2'     => :mysql,
    'PostgreSQL' => :postgresql,
    'SQLite'     => :sqlite,
  }.freeze

  def self.adapter
    name = ActiveRecord::Base.connection.adapter_name
    ADAPTERS.fetch(name) do
      raise UnsupportedAdapterError,
            "no SQL function mapping for adapter #{name.inspect} - see lib/adapter_functions.rb"
    end
  end

  def self.mysql?
    :mysql == adapter
  end

  # A random value for ORDER BY. MySQL spells it RAND(), the other two RANDOM().
  def self.random_function
    :mysql == adapter ? 'RAND()' : 'RANDOM()'
  end

  # A uniform random float in [0, 1). MySQL's RAND() and PostgreSQL's RANDOM()
  # already return one; SQLite's RANDOM() is a signed 64 bit integer and has to
  # be scaled down into that range.
  UNIFORM_RANDOM = {
    mysql:      'RAND()',
    postgresql: 'RANDOM()',
    sqlite:     '(ABS(RANDOM()) / 9223372036854775807.0)',
  }.freeze

  def self.uniform_random
    UNIFORM_RANDOM.fetch(adapter)
  end

  # Natural logarithm. LOG() is natural log on MySQL but base 10 on PostgreSQL
  # and SQLite, both of which call the natural one LN().
  def self.natural_log
    :mysql == adapter ? 'LOG' : 'LN'
  end
end

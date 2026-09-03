# frozen_string_literal: true

# db/schema.rb is dumped from MySQL and carries MySQL-only column options.
# PostgreSQL rejects two of them, so relax it here the same way
# sqlite3_schema_compatibility.rb does for SQLite.
#
# Only two shims are needed. Notably NOT needed, despite looking like problems:
#   * index `length: 191` (MySQL prefix indexes) - silently ignored by the
#     PostgreSQL adapter, and PostgreSQL has no 767-byte index limit to work
#     around in the first place.
#   * table-level `charset:` / `collation:` - swallowed by TableDefinition's
#     keyword catch-all, exactly as under SQLite.
return unless 'postgresql' == ENV.fetch('DB_ADAPTER', nil) ||
              ENV.fetch('DATABASE_URL', '').start_with?('postgres')

# The PostgreSQL3 TableDefinition class loads lazily, so require the adapter to
# force the class to exist before prepending onto it.
require 'active_record/connection_adapters/postgresql_adapter'

# `size: :medium` / `size: :long` are MySQL blob and text width hints
# (MEDIUMTEXT, LONGBLOB). PostgreSQL's text and bytea are unbounded, so the
# option is meaningless rather than wrong - but the adapter rejects unknown
# column options outright with `ArgumentError: Unknown key: :size`.
ActiveRecord::ConnectionAdapters::PostgreSQL::TableDefinition.prepend(
  Module.new do
    private

    def valid_column_definition_options
      super + [ :size ]
    end
  end
)

# Column-level `collation:` in schema.rb holds MySQL collation names
# ("utf8mb4_bin", "utf8mb4_0900_ai_ci"), emitted as a literal COLLATE clause.
# PostgreSQL raises `collation "utf8mb4_bin" for encoding "UTF8" does not
# exist` for every one of them.
#
# MySQL's naming convention carries the semantic split: a `_bin` suffix means
# byte-for-byte case-sensitive comparison, everything else (`_ci`, `_ai_ci`)
# means case-insensitive. "C" is PostgreSQL's byte-order collation, so `_bin`
# maps onto it directly. There is no built-in case-insensitive collation to map
# the `_ci` names onto - that needs citext or a nondeterministic ICU collation,
# which is a schema decision rather than a compatibility shim - so those are
# dropped and the column inherits the database default (case-sensitive).
#
# This has to be idempotent: maintain_test_schema! derives the test schema from
# the just-loaded connection, running every column through a second time, by
# which point the value is already "C" or absent.
ActiveRecord::ConnectionAdapters::PostgreSQL::SchemaCreation.prepend(
  Module.new do
    define_method(:add_column_options!) do |sql, options|
      collation = options[:collation].to_s

      if collation.start_with?('utf8', 'latin1')
        options = options.dup
        if collation.end_with?('_bin')
          options[:collation] = 'C'
        else
          options.delete(:collation)
        end
      end

      super(sql, options)
    end
    private :add_column_options!
  end
)

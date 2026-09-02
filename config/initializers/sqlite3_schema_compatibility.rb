# frozen_string_literal: true

# db/schema.rb is dumped from MySQL and carries MySQL-only column options like
# `size: :medium` (blob/text size hints - MEDIUMBLOB/LONGBLOB vs MySQL's default
# 64KB-capped TEXT/BLOB). Rails' SQLite3 adapter rejects unknown column options
# outright, so `db:schema:load` fails on a fresh SQLite database with
# `ArgumentError: Unknown key: :size` unless we widen the allow-list here.
#
# `:size` has no meaning to SQLite (TEXT/BLOB there are unbounded regardless),
# so this only relaxes validation - it never affects the SQL SQLite generates.
# Dumping stays MySQL-only (`config/environments/production.rb` disables
# dump_schema_after_migration, and MySQL is the only adapter used to author
# schema.rb), so this patch only needs to make *loading* tolerant, not dumping.
#
# The SQLite3::TableDefinition class loads lazily (only on `establish_connection`),
# so `defined?` at boot time would miss it - require the adapter file directly to
# force the class to exist before we prepend onto it.
require 'active_record/connection_adapters/sqlite3_adapter'

ActiveRecord::ConnectionAdapters::SQLite3::TableDefinition.prepend(
  Module.new do
    private

    def valid_column_definition_options
      super + [ :size ]
    end
  end
)

# Column-level `collation:` in schema.rb also comes from MySQL (e.g.
# "utf8mb4_unicode_ci", "utf8mb4_bin") and is emitted as a literal
# `COLLATE "<name>"` clause. SQLite only understands its own three built-in
# collations (BINARY, NOCASE, RTRIM), so it raises `SQLite3::SQLException:
# no such collation sequence` on any MySQL collation name.
#
# MySQL's naming convention carries the real semantic split we care about:
# `_bin` suffixes mean byte-for-byte case-sensitive comparison, everything
# else (`_ci`, `_ai_ci`, etc.) means case-insensitive. Map those to SQLite's
# closest built-ins - BINARY is SQLite's own default, so it's a no-op; NOCASE
# is ASCII-only case-insensitivity, not a full Unicode match for MySQL's `_ci`
# collations, but it's the closest built-in and keeps intent instead of
# silently becoming case-sensitive.
#
# This has to be idempotent: `maintain_test_schema!` derives the test
# database's schema from the just-loaded development connection, which runs
# every column back through here a second time - by then `options[:collation]`
# is already "BINARY"/"NOCASE" from the first pass, not a MySQL name, so
# already-mapped values must pass through unchanged rather than being
# re-mapped (a plain `_bin` suffix check would turn "BINARY" into "NOCASE").
sqlite_builtin_collations = %w[BINARY NOCASE RTRIM].freeze

ActiveRecord::ConnectionAdapters::SQLite3::SchemaCreation.prepend(
  Module.new do
    define_method(:add_column_options!) do |sql, options|
      if options[:collation] && sqlite_builtin_collations.exclude?(options[:collation])
        options = options.dup
        options[:collation] = options[:collation].end_with?('_bin') ? 'BINARY' : 'NOCASE'
      end

      super(sql, options)
    end
    private :add_column_options!
  end
)

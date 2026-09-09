# frozen_string_literal: true

# Resolves which database adapter is configured, from ENV alone - usable at boot
# (config/application.rb, config/initializers/*) before any ActiveRecord connection exists.
# AdapterFunctions (lib/adapter_functions.rb) covers the same three adapters but introspects
# a live connection, so it can't run this early.
module DbAdapterEnv
  def self.adapter
    database_url = ENV.fetch('DATABASE_URL', '')
    return :sqlite3    if 'sqlite3' == ENV.fetch('DB_ADAPTER', nil) || database_url.start_with?('sqlite3:')
    return :postgresql if 'postgresql' == ENV.fetch('DB_ADAPTER', nil) || database_url.start_with?('postgres')

    :mysql2
  end
end

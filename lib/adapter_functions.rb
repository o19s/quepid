# frozen_string_literal: true

# Quepid can run against either MySQL or SQLite (see config/database.yml), so a
# small number of places that use adapter-only SQL functions (RAND(), LOG()) need
# to branch on which one is active. Kept as one shared check rather than
# repeating the connection lookup at each call site.
module AdapterFunctions
  def self.mysql?
    'Mysql2' == ActiveRecord::Base.connection.adapter_name
  end
end

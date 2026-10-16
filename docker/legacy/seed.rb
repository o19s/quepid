# frozen_string_literal: true

# Loaded by Rails runner before the historical web/worker processes start.
module LegacySampleData
  STATE_TABLE = 'legacy_setup_states'
  STATE_NAME = 'sample_data'
  LOCK_NAME = 'quepid_legacy_sample_data'
  CASE_NAMES = [ 'SOLR CASE', 'ES CASE', 'SEARCHAPI CASE', '10s of Queries',
                 'Typeahead: Dairy', 'Typeahead: Meats', 'Typeahead: Dessert' ].freeze

  def self.prepare
    connection = ActiveRecord::Base.connection
    raise 'Legacy setup requires its isolated MySQL database' unless
      'Mysql2' == connection.adapter_name && connection.pool.db_config.database.start_with?('quepid_legacy_')

    locked = 1 == connection.select_value("SELECT GET_LOCK('#{LOCK_NAME}', 600)")
    raise 'Could not acquire historical sample-data setup lock' unless locked

    begin
      connection.execute("CREATE TABLE IF NOT EXISTS #{STATE_TABLE} (name VARCHAR(64) PRIMARY KEY)")
      return if connection.select_value("SELECT name FROM #{STATE_TABLE} WHERE name = '#{STATE_NAME}'")

      # Adopt the previously verified filesystem marker only when its data exists.
      if Rails.root.join('tmp/legacy-sample-data-ready').exist? && sample_data_present?
        record_completion(connection)
        return
      end

      raise 'Historical database contains untracked sample data; inspect it before reseeding' unless User.none? && Case.none? && Book.none?

      ActiveRecord::Base.transaction do
        yield
        raise 'Historical sample-data task did not create the required fixtures' unless sample_data_present?

        record_completion(connection)
      end
    ensure
      connection.execute("SELECT RELEASE_LOCK('#{LOCK_NAME}')")
    end
  end

  def self.sample_data_present?
    user = User.find_by(email: 'quepid+realisticactivity@o19s.com')
    user && (CASE_NAMES - user.cases.pluck(:case_name)).empty? &&
      user.cases.find_by(case_name: '10s of Queries').queries.exists? &&
      Book.find_by(name: 'Book of Ratings')&.query_doc_pairs&.exists?
  end

  def self.record_completion connection
    connection.execute("INSERT INTO #{STATE_TABLE} (name) VALUES ('#{STATE_NAME}')")
  end
end

LegacySampleData.prepare do
  require 'thor'
  load Rails.root.join('lib/tasks/sample_data.thor')
  SampleData.new.sample_data
end

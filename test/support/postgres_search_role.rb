# frozen_string_literal: true

module ActiveSupport
  class TestCase
    # PostgresSearchService refuses superusers, and the test database user usually is one, so
    # searches in tests log in as a plain role. It is created on its own connection, because
    # the test's transaction is invisible to the service's connection. Nil when the test user
    # can't create it.
    def postgres_search_credentials
      config = ActiveRecord::Base.connection_db_config.configuration_hash
      admin = PG.connect(host: config[:host], port: config[:port], dbname: config[:database],
                         user: config[:username], password: config[:password])
      return unless 'on' == admin.parameter_status('is_superuser')

      admin.exec(<<~SQL.squish)
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'quepid_search_test') THEN
            CREATE ROLE quepid_search_test LOGIN PASSWORD 'quepid_search_test';
          END IF;
        END $$;
        GRANT USAGE ON SEQUENCE users_id_seq TO quepid_search_test;
      SQL
      'quepid_search_test:quepid_search_test'
    ensure
      admin&.close
    end
  end
end

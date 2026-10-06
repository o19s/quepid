# Generated from Rails Pulse schema - automatically loads current schema definition
class InstallRailsPulseTables < ActiveRecord::Migration[8.1]
  def up
    # Check if Rails Pulse is already installed
    if rails_pulse_installed?
      say "Rails Pulse tables already exist. Skipping installation.", :yellow
      return
    end

    # Load and execute the Rails Pulse schema directly
    # This ensures the migration is always in sync with the schema file
    schema_file = File.join(::Rails.root.to_s, "db/rails_pulse_schema.rb")

    if File.exist?(schema_file)
      say "Loading Rails Pulse schema from db/rails_pulse_schema.rb"

      # Load the schema file to define RailsPulse::Schema
      load schema_file

      # Execute the schema in the context of this migration
      RailsPulse::Schema.call(connection)

      say "Rails Pulse tables created successfully"
      say "The schema file db/rails_pulse_schema.rb remains as your single source of truth"
    else
      raise "Rails Pulse schema file not found at db/rails_pulse_schema.rb"
    end
  end

  def down
    # Rollback: drop all Rails Pulse tables in reverse dependency order
    say "Dropping Rails Pulse tables..."

    drop_table :rails_pulse_operations if table_exists?(:rails_pulse_operations)
    drop_table :rails_pulse_job_runs if table_exists?(:rails_pulse_job_runs)
    drop_table :rails_pulse_jobs if table_exists?(:rails_pulse_jobs)
    drop_table :rails_pulse_summaries if table_exists?(:rails_pulse_summaries)
    drop_table :rails_pulse_requests if table_exists?(:rails_pulse_requests)
    drop_table :rails_pulse_routes if table_exists?(:rails_pulse_routes)
    drop_table :rails_pulse_queries if table_exists?(:rails_pulse_queries)
    drop_table :rails_pulse_exception_occurrences if table_exists?(:rails_pulse_exception_occurrences)
    drop_table :rails_pulse_exception_groups if table_exists?(:rails_pulse_exception_groups)
    drop_table :rails_pulse_deployments if table_exists?(:rails_pulse_deployments)

    say "Rails Pulse tables dropped successfully"
  end

  private

  def rails_pulse_installed?
    %i[
      rails_pulse_routes rails_pulse_queries rails_pulse_requests
      rails_pulse_operations rails_pulse_jobs rails_pulse_job_runs
      rails_pulse_summaries rails_pulse_deployments
      rails_pulse_exception_groups rails_pulse_exception_occurrences
    ].all? { |table| table_exists?(table) }
  end
end

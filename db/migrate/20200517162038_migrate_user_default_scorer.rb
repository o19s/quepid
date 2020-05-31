class MigrateUserDefaultScorer < ActiveRecord::Migration
  def change

    if foreign_keys("users").any?{|k| k[:to_table] == "default_scorers"}
      remove_foreign_key :users, column: :default_scorer_id
    end

    # Save any customizations that people have set.
    MigrateUserDefaultScorer.connection.execute(
      "UPDATE users
      SET default_scorer_id = scorer_id
      WHERE scorer_id IS NOT NULL"
    )

    add_column :scorers, :communal, :boolean, default: false
  end
end

class DeleteDefaultScorerTableFromDatabase < ActiveRecord::Migration[5.2]
  def change

    # get rid of a remnant table
    DeleteDefaultScorerTableFromDatabase.connection.execute(
      "
      DROP TABLE IF EXISTS default_scorers
      "
    )
  end
end

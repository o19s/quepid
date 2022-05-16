class BetterTextEncodingInDatabase < ActiveRecord::Migration[6.1]
  def change
    # change all text encodings to default utf8mb4.
    # did NOT change users.password as that is super old from the Flask app days!

    BetterTextEncodingInDatabase.connection.execute(
      "
      SET SESSION MAX_EXECUTION_TIME=360000;
      ALTER TABLE snapshot_docs CHANGE `explain` `explain` MEDIUMTEXT  CHARACTER SET `utf8mb4`  COLLATE `utf8mb4_general_ci`  NULL;
      "
    )
  end
end

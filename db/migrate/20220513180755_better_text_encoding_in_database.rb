class BetterTextEncodingInDatabase < ActiveRecord::Migration[6.1]
  def change
    # change all text encodings to default utf8mb4.
    # did NOT change users.password as that is super old from the Flask app days!

    # ALTER TABLE ... CHANGE ... CHARACTER SET is MySQL-only DDL; SQLite has no
    # character set concept to change.
    return unless connection.adapter_name == 'Mysql2'

    BetterTextEncodingInDatabase.connection.execute(
      "
      ALTER TABLE snapshot_docs CHANGE `explain` `explain` MEDIUMTEXT  CHARACTER SET `utf8mb4`  COLLATE `utf8mb4_general_ci`  NULL;
      "
    )
  end
end

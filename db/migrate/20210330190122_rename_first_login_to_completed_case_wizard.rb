class RenameFirstLoginToCompletedCaseWizard < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :completed_case_wizard, :boolean, null: false, default: 0

    # Copy the data over, flipping the true to false and the false to true!
    RenameFirstLoginToCompletedCaseWizard.connection.execute(
      "
      update users set completed_case_wizard = 1
      where first_login = 0
      "
    )
    RenameFirstLoginToCompletedCaseWizard.connection.execute(
      "
      update users set completed_case_wizard = 0
      where first_login = 1
      "
    )
    remove_column :users, :first_login
  end
end

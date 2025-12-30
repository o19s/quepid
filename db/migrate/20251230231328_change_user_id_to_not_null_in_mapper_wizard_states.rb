class ChangeUserIdToNotNullInMapperWizardStates < ActiveRecord::Migration[8.1]
  def up
    # Remove any orphaned records with null user_id before adding constraint
    MapperWizardState.where(user_id: nil).delete_all

    change_column_null :mapper_wizard_states, :user_id, false
  end

  def down
    change_column_null :mapper_wizard_states, :user_id, true
  end
end

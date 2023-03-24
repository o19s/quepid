class AddUnrateableToJudgements < ActiveRecord::Migration[7.0]
  def change
    add_column :judgements, :unrateable, :boolean, :default => false
  end
end

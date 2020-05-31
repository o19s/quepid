class AddFkToScorers < ActiveRecord::Migration
  def change

    remove_column :users, :scorer_id
    add_foreign_key "users", "scorers", column: "default_scorer_id"

  end
end

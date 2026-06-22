class CreateToolCalls < ActiveRecord::Migration[8.1]
  def change
    create_table :tool_calls do |t|
      t.string :tool_call_id, null: false
      t.string :name, null: false
      t.text :thought_signature

      t.json :arguments

      t.timestamps
    end

    add_index :tool_calls, :tool_call_id, unique: true
    add_index :tool_calls, :name
  end
end

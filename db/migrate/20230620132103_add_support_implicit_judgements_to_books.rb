class AddSupportImplicitJudgementsToBooks < ActiveRecord::Migration[7.0]
  def change
    add_column :books, :support_implicit_judgements, :boolean
  end
end

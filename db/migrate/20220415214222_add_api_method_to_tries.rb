class AddApiMethodToTries < ActiveRecord::Migration[6.1]
  def change
    add_column :tries, :api_method, :string
  end
end

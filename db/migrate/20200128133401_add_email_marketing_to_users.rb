class AddEmailMarketingToUsers < ActiveRecord::Migration[4.2]
  def change
    add_column :users, :email_marketing, :boolean, null: false, default: false
  end
end

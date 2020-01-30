class AddEmailMarketingToUsers < ActiveRecord::Migration
  def change
    add_column :users, :email_marketing, :boolean, null: false, default: false
  end
end

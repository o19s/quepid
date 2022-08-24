 class AddRemoteQueryOption < ActiveRecord::Migration[6.1]
   def change
     add_column :tries, :remote_enabled, :boolean, default: false
   end
 end

class MapUsersAndJudgesToType < ActiveRecord::Migration[8.0]
  def change
    User.where(llm_key: nil).update_all(type: 'User')
    User.where.not(llm_key: nil).update_all(type: 'Judge')    
    
    add_index :users, :type
  end
end

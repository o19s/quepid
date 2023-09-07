class AddOptionToShowRankWhenJudging < ActiveRecord::Migration[7.0]
  def change
    add_column :books, :show_rank, :boolean, default: false
  end
end

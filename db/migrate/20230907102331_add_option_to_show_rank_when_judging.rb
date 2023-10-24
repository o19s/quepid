class AddOptionToShowRankWhenJudging < ActiveRecord::Migration[7.0]
  def change
    # We managed to get out of order in some of our migrations, so this lets us rerun the
    # migration and not error out if the show_rank already exists.
    unless column_exists?(:books, :show_rank)
      add_column :books, :show_rank, :boolean, default: false
    end
  end
end

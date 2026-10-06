# frozen_string_literal: true

class AddRankDepthToBooks < ActiveRecord::Migration[8.1]
  def change
    add_column :books, :rank_depth, :integer
  end
end

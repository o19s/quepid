class UpdateQueryUpdatedAtWithRatings < ActiveRecord::Migration[7.1]
  def change
    execute <<-SQL
      UPDATE queries SET updated_at = GREATEST(updated_at, (SELECT MAX(updated_at) FROM ratings WHERE query_id = queries.id))
    SQL
  end
end

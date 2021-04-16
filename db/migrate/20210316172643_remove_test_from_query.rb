class RemoveTestFromQuery < ActiveRecord::Migration[5.2]
  def change


#    if foreign_keys("users").any?{|k| k[:to_table] == "default_scorers"}
#      remove_foreign_key :users, column: :default_scorer_id
#    end

    # Save any customizations that people have set.
    RemoveTestFromQuery.connection.execute(
      "
      update users set default_scorer_id = (select id from scorers where communal=1 and name='AP@10')
      where default_scorer_id in (select id from scorers where query_id is not null)"
    )

    RemoveTestFromQuery.connection.execute(
      "
      update queries set scorer_id = null, scorer_enbl = false where scorer_id is not null"
    )


    remove_column :queries, :scorer_id
    remove_column :queries, :scorer_enbl

    remove_column :scorers, :query_test
    remove_column :scorers, :query_id
  end
end

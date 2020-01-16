class RenameQueryParamsInTries < ActiveRecord::Migration
  def change
    # Note, this failed once on werid data in queryParams, but manually running worked:
    # ALTER TABLE `tries` CHANGE `queryParams` `query_params` varchar(20000) DEFAULT NULL
    # Then skip the failed migration by inserting a fake record:
    # INSERT INTO schema_migrations (version) VALUES (20200115021550)
    rename_column :tries, :queryParams, :query_params
  end
end

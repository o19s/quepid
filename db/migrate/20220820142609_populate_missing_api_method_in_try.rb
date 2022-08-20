class PopulateMissingApiMethodInTry < ActiveRecord::Migration[6.1]
  def change
    # Set defaults for the api_method

    PopulateMissingApiMethodInTry.connection.execute(
      "
      UPDATE TABLE tries SET api_method = 'POST' WHERE search_engine = 'es' AND api_method IS NULL;
      "
    )
    PopulateMissingApiMethodInTry.connection.execute(
      "
      UPDATE TABLE tries SET api_method = 'JSONP' WHERE search_engine = 'solr' AND api_method IS NULL;
      "
    )
  end
end

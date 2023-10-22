class DropSearchEndpointFieldsFromTry < ActiveRecord::Migration[7.0]
  def change
    # I'm going to comment this out to take this go live process slower for now.
    # Now that we've moved all the fields over to SearchEndpoint, lets
    # clean up after ourselves.
    #remove_column :tries, :search_engine
    #remove_column :tries, :search_url
    #remove_column :tries, :api_method
    #remove_column :tries, :custom_headers
  end
end

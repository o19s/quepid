class CreateSearchEndpointsFromTries < ActiveRecord::Migration[7.0]
  def change
    
    # Discovered that there are tries that have null case's from 2016.  We need to clean this up.
    
    Try.all.where(case_id: nil) do |try|
      t.destroy!
    end
    
    
    Try.all.each do |try|
      
      # Go through and find each unique set of values from all the tries,
      # and create a single end point that is used by multiple tries where it
      # doesn't change.
      
      search_endpoint = SearchEndpoint.find_or_create_by search_engine: try.search_engine,
        endpoint_url: try.search_url,
        api_method: try.api_method,
        custom_headers: try.custom_headers,
        owner: try.case.owner,
        name: "#{try.search_engine} #{try.search_url}"
      
      try.search_endpoint = search_endpoint
      
      search_endpoint.save!  
      try.save!
            
    end
  end
end

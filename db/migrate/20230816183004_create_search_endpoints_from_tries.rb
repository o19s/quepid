class CreateSearchEndpointsFromTries < ActiveRecord::Migration[7.0]
  def change    
    puts "Found #{Try.all.where(case_id: nil).count} tries with no Case.  Any is bad!"
    
    Try.where(search_endpoint: nil).find_each do |try|
      
      # Go through and find each unique set of values from all the tries,
      # and create a single end point that is used by multiple tries where it
      # doesn't change.
      
      search_endpoint = SearchEndpoint.find_or_create_by search_engine: try.search_engine,
        endpoint_url: try.search_url,
        api_method: try.api_method,
        custom_headers: try.custom_headers,
        owner: try.case.owner
      
      try.search_endpoint = search_endpoint
      
      search_endpoint.save!  
      try.save!

      try.case.teams.each do |team|
        # currently missing a database level constraint so manually check
        unless search_endpoint.teams.include?(team)
          search_endpoint.teams << team
        end
      end
      search_endpoint.save!
    end  
  
    # find search_endpoints where all the cases are archived, and mark them archived.
    SearchEndpoint.find_each do |search_endpoint|
      all_cases_archived = true
      search_endpoint.tries.each do |try|
        if !try.case.archived?
          all_cases_archived = false 
          break
        end
      end
      search_endpoint.archived = all_cases_archived
      search_endpoint.save!
    end
  end
end

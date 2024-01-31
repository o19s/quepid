class EnsureOwnerIdForSearchEndpoints < ActiveRecord::Migration[7.1]
  def change    
    # Discoverd that there are search endpoints being created without an owner!
    
    puts "Found #{SearchEndpoint.all.where(owner_id: nil).count} search endpoints missing owner"
    
    SearchEndpoint.all.where(owner_id: nil).each do |se|
      # only do this where we have a try related...
      if se.tries.last
        se.owner = se.tries.last.case.owner      
      end
      se.save!
    end
  end
end

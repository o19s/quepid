class EnsureOwnerIdForSearchEndpoints < ActiveRecord::Migration[7.1]
  def change
    
    # Discoverd that there are search endpoints being created without an owner!
    
    puts "Found #{SearchEndpoint.all.where(owner_id: nil).count} search endpoints missing owner"
    
    SearchEndpoint.all.where(owner_id: nil).each do |se|
      se.owner = se.tries.last.case.owner
      se.save!
    end
  end
end

class DeleteBogusTries < ActiveRecord::Migration[7.0]
  def change
    
    # Discovered that there are tries that have null case's from 2016.  We need to clean this up.
    
    puts "Found #{Try.all.where(case_id: nil).count} bogus tries to destroy."
    
    Try.all.where(case_id: nil) do |try|
      try.destroy!
    end
  end
end

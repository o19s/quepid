class AddOwnersAsMembers < ActiveRecord::Migration[8.0]
  def change
    teams = Team.all
    teams.each do |team|
      owner = team.owner
      unless team.members.include?(owner)
        puts "Updating team #{team.name} for new member"
        team.members << owner
        team.save!
      end
    end
  end
end

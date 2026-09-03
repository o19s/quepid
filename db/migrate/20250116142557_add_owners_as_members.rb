class AddOwnersAsMembers < ActiveRecord::Migration[8.0]
  # the awkward use of SQL is because when the migration runs, we've already
  # dropped the "owner" relationship from the team
  def change
    teams = Team.all
    teams.each do |team|
      owner_id = ActiveRecord::Base.connection.select_value(
        "SELECT owner_id FROM teams WHERE id = #{team.id}"
      )
      owner = User.find(owner_id)
      unless team.members.include?(owner)
        puts "Adding previous owner #{owner.name} to team #{team.name} as new member"
        team.members << owner
        team.save!
      end
    end
  end
end

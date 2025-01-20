class AssignJudgementsForDeletedUsersToAnonymous < ActiveRecord::Migration[7.1]
  def change
    judgements = Judgement.left_outer_joins(:user).where(users: { id: nil })
    judgements.each do |j|
      j.user = nil
      j.save!
    end
  end
end

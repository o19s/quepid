class UpdateDefaultScorersForLegacyV1Behavior < ActiveRecord::Migration
  def up
    UpdateDefaultScorersForLegacyV1Behavior.connection.execute(
      "UPDATE default_scorers
      SET code =
      '// Gets the average score over a scale of 100
      // (assumes query rating on a scale of 1-10)
      var score = avgRating100(10);
      if (score !== null) {
      // Adds a distance penalty to the score
      score -= editDistanceFromBest(10);
      }
      setScore(score);'
      WHERE name = 'v1'")
  end
  def down
    UpdateDefaultScorersForLegacyV1Behavior.connection.execute(
      "UPDATE default_scorers
      SET code =
      '// Gets the average score over a scale of 100
      // (assumes query rating on a scale of 1-10)
      var score = avgRating100();
      if (score !== null) {
      // Adds a distance penalty to the score
      score -= editDistanceFromBest();
      }
      setScore(score);'
      WHERE name = 'v1'")
  end
end

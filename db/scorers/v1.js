// Gets the average score over a scale of 100
// (assumes query rating on a scale of 1-10)
var score = avgRating100(10);
if (score !== null) {
  // Adds a distance penalty to the score
  score -= editDistanceFromBest(10);
}
setScore(score);

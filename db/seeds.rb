# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

DefaultScorer.first_or_create(
  scale:  (1..10).to_a,
  code:   [
    '// Gets the average score over a scale of 100',
    '// (assumes query rating on a scale of 1-10)',
    'var score = avgRating100(10);',
    'if (score !== null) {',
    '  // Adds a distance penalty to the score',
    '  score -= editDistanceFromBest(10);',
    '}',
    'setScore(score);',
  ].join("\n"),
  name:         'v1',
  state:        'published',
  published_at: Time.new(2014, 01, 01),
  default:      true
)

if ENV['SEED_SAMPLE_DATA']
  require_relative 'sample_data_seeds'
end

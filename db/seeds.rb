# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

puts File.readlines('./db/scorers/v1.js')


DefaultScorer.where(name: 'v1').first_or_create(
  scale:        (1..10).to_a,
  code:         File.readlines('./db/scorers/v1.js','\n').join('\n'),
  name:         'v1',
  state:        'published',
  published_at: Time.new(2014, 01, 01)
)

DefaultScorer.where(name: 'nDCG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/ndcg@5.js','\n').join('\n'),
  name:               'nDCG@5',
  state:              'published',
  published_at:       Time.new(2020, 3, 16)
)

DefaultScorer.where(name: 'DCG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/dcg@5.js','\n').join('\n'),
  name:               'DCG@5',
  state:              'published',
  published_at:       Time.new(2020, 3, 20)
)

DefaultScorer.where(name: 'CG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/cg@5.js','\n').join('\n'),
  name:               'CG@5',
  state:              'published',
  published_at:       Time.new(2020, 3, 20)
)


if ENV['SEED_SAMPLE_DATA']
  require_relative 'sample_data_seeds'
end

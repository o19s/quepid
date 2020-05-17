# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rake db:seed (or created alongside the db with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

Scorer.where(name: 'v1').first_or_create(
  scale:        (1..10).to_a,
  code:         File.readlines('./db/scorers/v1.js','\n').join('\n'),
  name:         'v1',
  state:        'published',
  published_at: Time.new(2014, 01, 01)
)

Scorer.where(name: 'nDCG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/ndcg@5.js','\n').join('\n'),
  name:               'nDCG@5',
  state:              'published',
  published_at:       Time.new(2020, 3, 16)
)

Scorer.where(name: 'DCG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/dcg@5.js','\n').join('\n'),
  name:               'DCG@5',
  default_scorer:     true
)

Scorer.where(name: 'CG@5').first_or_create(
  scale:              (0..4).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/cg@5.js','\n').join('\n'),
  name:               'CG@5',
  default_scorer:     true
)

DefaultScorer.where(name: 'P@5').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/p@5.js','\n').join('\n'),
  name:               'P@5',
  default_scorer:     true
)

Scorer.where(name: 'AP@5').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/ap@5.js','\n').join('\n'),
  name:               'AP@5',
  default_scorer:     true
)

if ENV['SEED_SAMPLE_DATA']
  require_relative 'sample_data_seeds'
end

# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the rails db:seed command (or created alongside the database with db:setup).
#
# Examples:
#
#   cities = City.create([{ name: 'Chicago' }, { name: 'Copenhagen' }])
#   Mayor.create(name: 'Emanuel', city: cities.first)

Scorer.where(name: 'nDCG@10').first_or_create!(
  scale:                  (0..3).to_a,
  scale_with_labels:      {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
  show_scale_labels:      true,
  code:                   File.readlines('./db/scorers/ndcg@10.js','\n').join('\n'),
  name:                   'nDCG@10',
  communal:               true
)

Scorer.where(name: 'DCG@10').first_or_create(
  scale:              (0..3).to_a,
  scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/dcg@10.js','\n').join('\n'),
  name:               'DCG@10',
  communal:           true
)

Scorer.where(name: 'CG@10').first_or_create(
  scale:              (0..3).to_a,
  scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/cg@10.js','\n').join('\n'),
  name:               'CG@10',
  communal:           true
)

Scorer.where(name: 'P@10').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/p@10.js','\n').join('\n'),
  name:               'P@10',
  communal:           true
)

Scorer.where(name: 'AP@10').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/ap@10.js','\n').join('\n'),
  name:               'AP@10',
  communal:           true
)

Scorer.where(name: 'RR@10').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/rr@10.js','\n').join('\n'),
  name:               'RR@10',
  communal:           true
)

SelectionStrategy.where(name: 'Single Rater').first_or_create(
  name: 'Single Rater',
  description: 'A single rating for each query/doc pair is all that is required.  The fastest way to get a lot of ratings, with lower quality.'
)

SelectionStrategy.where(name: 'Multiple Raters').first_or_create(
  name: 'Multiple Raters',
  description: 'Allows you to have up to three ratings for each query/doc pair.   Gives higher quality ratings, however with more work.'
)

if ENV['SEED_SAMPLE_DATA']
  require_relative 'sample_data_seeds'
end

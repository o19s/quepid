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
  communal:               true,
  manual_max_score:       true,
  manual_max_score_value: 1,
  tooltip:                'tool tip here',
  description:                'Normalized discounted sum of the gain values. The ratio of the DCG to the Ideal DCG that results from the optimal ordering of the rated relevant documents. Useful for comparing across queries. Useful for averaging over multiple queries.',
  rollup_method:          'average_of_scores'
)

Scorer.where(name: 'DCG@10').first_or_create(
  scale:              (0..3).to_a,
  scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/dcg@10.js','\n').join('\n'),
  name:               'DCG@10',
  communal:           true,
  tooltip:                'tool tip here',
  description:                'Discounted sum of the gain values. Not useful for comparing across queries. Not useful for averaging over multiple queries.',
  rollup_method:          'sum_of_scores'
)

Scorer.where(name: 'CG@10').first_or_create(
  scale:              (0..3).to_a,
  scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/cg@10.js','\n').join('\n'),
  name:               'CG@10',
  communal:           true,
  description:                'Simple sum of the gain values. Not useful for comparing across queries. Not useful for averaging over multiple queries.',
  rollup_method:          'sum_of_scores'
)

Scorer.where(name: 'P@10').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/p@10.js','\n').join('\n'),
  name:               'P@10',
  communal:           true,
  tooltip:                'tool tip here',
  description:                'The effective accuracy, of the top k (10) retrieved, how many of them were in the set of documents rated relevant. Useful for comparing across queries. Useful for averaging across queries.',
  rollup_method:          'average_of_scores'
)

Scorer.where(name: 'AP@10').first_or_create(
  scale:              (0..1).to_a,
  scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
  show_scale_labels:  true,
  code:               File.readlines('./db/scorers/ap@10.js','\n').join('\n'),
  name:               'AP@10',
  communal:           true,
  tooltip:                'tool tip here',
  description:                '(while still called @10, AP is computed on |R| the set of all relevant documents) The average of the precision points (accuracy) at each rank at which a relevant document appears. This average is across the full set of relevant documents. Useful for comparing across queries. Useful for averaging over multiple queries. This metric is the most common summary metric for capturing overall performance of a retrieval system independent of the retrieval task.',
  rollup_method:          'sum_of_scores'
)

if ENV['SEED_SAMPLE_DATA']
  require_relative 'sample_data_seeds'
end

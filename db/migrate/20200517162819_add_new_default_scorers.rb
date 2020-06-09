class AddNewDefaultScorers < ActiveRecord::Migration
  def change

    Scorer.where(name: 'v1').first_or_create(
      scale:              (1..10).to_a,
      show_scale_labels:  false,
      code:               File.readlines('./db/scorers/v1.js','\n').join('\n'),
      name:               'v1',
      communal:           true
    )

    Scorer.where(name: 'nDCG@5').first_or_create(
      scale:                  (0..4).to_a,
      scale_with_labels:      {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
      show_scale_labels:      true,
      code:                   File.readlines('./db/scorers/ndcg@5.js','\n').join('\n'),
      name:                   'nDCG@5',
      communal:               true,
      manual_max_score:       true,
      manual_max_score_value: 1
    )

    Scorer.where(name: 'DCG@5').first_or_create(
      scale:              (0..4).to_a,
      scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/dcg@5.js','\n').join('\n'),
      name:               'DCG@5',
      communal:           true
    )

    Scorer.where(name: 'CG@5').first_or_create(
      scale:              (0..4).to_a,
      scale_with_labels:  {"0":"Irrelevant","1":"Poor","2":"Fair","3":"Good","4":"Perfect"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/cg@5.js','\n').join('\n'),
      name:               'CG@5',
      communal:           true
    )

    Scorer.where(name: 'P@5').first_or_create(
      scale:              (0..1).to_a,
      scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/p@5.js','\n').join('\n'),
      name:               'P@5',
      communal:           true
    )

    Scorer.where(name: 'AP@5').first_or_create(
      scale:              (0..1).to_a,
      scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/ap@5.js','\n').join('\n'),
      name:               'AP@5',
      communal:           true
    )
  end
end

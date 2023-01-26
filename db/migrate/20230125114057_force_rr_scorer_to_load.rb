class ForceRrScorerToLoad < ActiveRecord::Migration[6.1]
  # We use Seeds to setup a new environment, but in production
  # we don't run that so force it.
  def change

    Scorer.where(name: 'RR@10').first_or_create(
      scale:              (0..1).to_a,
      scale_with_labels:  {"0":"Irrelevant","1":"Relevant"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/rr@10.js','\n').join('\n'),
      name:               'RR@10',
      communal:           true
    )    
  end
end

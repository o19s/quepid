class AddErr < ActiveRecord::Migration[8.0]
  def change
    Scorer.where(name: 'ERR@10').first_or_create(
      scale:              (0..3).to_a,
      scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/err@10.js','\n').join('\n'),
      name:               'ERR@10',
      communal:           true
    )    
  end
end

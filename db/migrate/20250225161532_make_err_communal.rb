class MakeErrCommunal < ActiveRecord::Migration[8.0]
  def change
    scorer = Scorer.where(name: 'ERR@10').first
    
    if scorer.nil?
      scorer = Scorer.new(name: 'ERR@10', communal: true)
    end
    
    scorer.update(
      scale:              (0..3).to_a,
      scale_with_labels:  {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"},
      show_scale_labels:  true,
      code:               File.readlines('./db/scorers/err@10.js','\n').join('\n'),
      name:               'ERR@10',
      communal:           true
    )    
  end
end

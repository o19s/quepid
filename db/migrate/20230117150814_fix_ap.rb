class FixAp < ActiveRecord::Migration[6.1]
  def change
    score_name = 'AP@10'
    scorer = Scorer.where(name: scorer_name, communal: true).first
    name = scorer.name
    scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
    scorer.save!
  end
end

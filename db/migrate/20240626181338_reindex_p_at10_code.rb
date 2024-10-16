class ReindexPAt10Code < ActiveRecord::Migration[7.1]
  # force existing P@10 scorers to reload using the latest scorer information.
  def change
    scorers_to_update = ['P@10']
    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name, communal: true).first
      name = scorer.name
      scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
      scorer.save!
    end    
  end
end

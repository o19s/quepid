# It appears that we still have k=5, even through the scores are labeled as @10, so fix this.
# caused by the previous scorer had an errant "," after the scorer.code line
class RedoCommunalScorersMissingProperK < ActiveRecord::Migration
  def change

    scorers_to_update = ['P@10', 'AP@10','nDCG@10', 'DCG@10', 'CG@10']

    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name, communal: true).first
      unless scorer.nil?
        name = scorer.name
        scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
        scorer.save!
      end
    end
  end
end

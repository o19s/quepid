# Fix score for results with hitCount<k by simplifying padding of missing docs & missing ratings.
# See https://github.com/o19s/quepid/pull/336
class UpdateNdcgScorer < ActiveRecord::Migration[5.2]
  def change
    scorers_to_update = ['nDCG@10']
    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name, communal: true).first
      name = scorer.name
      scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
      scorer.save!
    end
  end
end

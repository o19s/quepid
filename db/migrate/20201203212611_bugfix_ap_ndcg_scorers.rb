# See https://github.com/o19s/quepid/issues/225
class BugfixApNdcgScorers < ActiveRecord::Migration
  def change
    scorers_to_update = ['AP@10','nDCG@10']
    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name, communal: true).first
      name = scorer.name
      scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
      scorer.save!
    end
  end
end

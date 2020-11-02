class ChangeDefaultScorersToAtTenDeep < ActiveRecord::Migration
  def change

    scorers_to_update = ['P@5', 'AP@5','nDCG@5', 'DCG@5', 'CG@5']

    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name, communal: true).first
      unless scorer.nil?
        name = scorer.name
        name.sub!('@5', '@10')
        scorer.name = name
        scorer.code = File.readlines("./db/scorers/#{name.downcase}.js",'\n').join('\n')
        scorer.save!
      end


    end


  end
end

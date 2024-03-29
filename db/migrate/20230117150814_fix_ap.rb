class FixAp < ActiveRecord::Migration[6.1]
  # We use Seeds to setup a new environment, but in production
  # we don't run that so force it.
  def change
    scorers_to_update = ['AP@10']
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

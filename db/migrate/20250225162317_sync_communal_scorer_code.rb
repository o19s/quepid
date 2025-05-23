class SyncCommunalScorerCode < ActiveRecord::Migration[8.0]
  def change    
    Scorer.communal.each do |scorer|
      file_name = scorer.name.downcase + '.js'  
      if file_name =="v1 (legacy).js"
        file_name = "v1.js"
      end
      scorer.update( code:               File.readlines("./db/scorers/#{file_name}",'\n').join('\n'))
    end
  end
end

class ChangeToZeroToThreeGrading < ActiveRecord::Migration
  def change

    scale_with_labels = {"0":"Poor","1":"Fair","2":"Good","3":"Perfect"}

    scorers_to_update = ['nDCG@5', 'DCG@5', 'CG@5']

    scorers_to_update.each do |scorer_name|
      scorer = Scorer.where(name: scorer_name).first
      unless scorer.nil?
        scorer.scale = (0..3).to_a
        scorer.scale_with_labels = scale_with_labels
        scorer.save!
      end


    end
  end
end

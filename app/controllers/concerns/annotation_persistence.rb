# frozen_string_literal: true

# Both browser HTML and JSON API responses use the same score-capture contract.
module AnnotationPersistence
  private

  def create_annotation_with_score
    # Read both param sets up front so a malformed request can't leave a score behind.
    the_annotation_params = annotation_params
    the_score_params = score_params.merge(
      user_id:    current_user.id,
      created_at: Time.zone.now
    )

    @score = @case.scores.build the_score_params
    return @score unless @score.save

    @annotation = Annotation.new the_annotation_params
    @annotation.user = current_user
    @annotation.score = @score
    @annotation.save
    @annotation
  end

  def annotation_params
    params.expect(annotation: [ :message, :source ])
  end

  def score_params
    params.expect(
      score: [ :all_rated,
               :score,
               :try_id,
               { queries: [] } ]
    )
  end
end

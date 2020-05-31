class RemoveScorerType < ActiveRecord::Migration
  # Note: we are leaving the default_scorer table alone for now in case
  # we need to bring it back, we don't want to lose the data.  Just in case..
  def change

    # This script is supporting migrating the database for Quepid 6.2 on the hosted
    # app.quepid.com platform.
    # there are 4 DefaultScorers in app.quepid.com

    MigrateUserDefaultScorer.connection.execute(
      "
      INSERT INTO scorers (
        code,
        name,
        scale,
        manual_max_score,
        manual_max_score_value,
        show_scale_labels,
        scale_with_labels,
        created_at,
        updated_at
      )
      SELECT  code,
      name,
      scale,
      manual_max_score,
      manual_max_score_value,
      show_scale_labels,
      scale_with_labels,
      created_at,
      updated_at
      FROM    default_scorers WHERE id = 1

      SET @last_id_in_scorers = LAST_INSERT_ID();

      update cases set scorer_id = @last_id_in_scorers, scorer_type = 'Scorer' where scorer_id =1 and scorer_type = 'DefaultScorer'

      INSERT INTO scorers (
        code,
        name,
        scale,
        manual_max_score,
        manual_max_score_value,
        show_scale_labels,
        scale_with_labels,
        created_at,
        updated_at
      )
      SELECT  code,
      name,
      scale,
      manual_max_score,
      manual_max_score_value,
      show_scale_labels,
      scale_with_labels,
      created_at,
      updated_at
      FROM    default_scorers WHERE id = 2

      SET @last_id_in_scorers = LAST_INSERT_ID();

      update cases set scorer_id = @last_id_in_scorers, scorer_type = 'Scorer' where scorer_id =2 and scorer_type = 'DefaultScorer'

      INSERT INTO scorers (
        code,
        name,
        scale,
        manual_max_score,
        manual_max_score_value,
        show_scale_labels,
        scale_with_labels,
        created_at,
        updated_at
      )
      SELECT  code,
      name,
      scale,
      manual_max_score,
      manual_max_score_value,
      show_scale_labels,
      scale_with_labels,
      created_at,
      updated_at
      FROM    default_scorers WHERE id = 3

      SET @last_id_in_scorers = LAST_INSERT_ID();

      update cases set scorer_id = @last_id_in_scorers, scorer_type = 'Scorer' where scorer_id =3 and scorer_type = 'DefaultScorer'

      INSERT INTO scorers (
        code,
        name,
        scale,
        manual_max_score,
        manual_max_score_value,
        show_scale_labels,
        scale_with_labels,
        created_at,
        updated_at
      )
      SELECT  code,
      name,
      scale,
      manual_max_score,
      manual_max_score_value,
      show_scale_labels,
      scale_with_labels,
      created_at,
      updated_at
      FROM    default_scorers WHERE id = 4

      SET @last_id_in_scorers = LAST_INSERT_ID();

      update cases set scorer_id = @last_id_in_scorers, scorer_type = 'Scorer' where scorer_id =4 and scorer_type = 'DefaultScorer'

      // check that everything migrated
      // select count(*) from cases where scorer_type = 'DefaultScorer'"
    )
    remove_column :cases,   :scorer_type
    remove_column :queries, :scorer_type
  end
end

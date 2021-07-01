class UpdateAnonymousRatingsToCaseOwner < ActiveRecord::Migration[5.2]
  def change
    # copy over to the existing ratings the owner of all cases.
    UpdateAnonymousRatingsToCaseOwner.connection.execute(
      "UPDATE ratings r
      INNER JOIN queries q ON r.query_id = q.id
      INNER JOIN cases c ON q.case_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      SET r.user_id = u.id"
    )

    # Check with this query:
    # select u.id, r.user_id from users u, cases c, queries q, ratings r where u.id = c.user_id and c.id = q.case_id and q.id = r.query_id
  end
end

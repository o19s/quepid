class FixNullCreatedAtUpdatedAt < ActiveRecord::Migration[6.1]
  # This migration is really just meant for the production go.quepidapp.com database.
  # we built this app in Flask a million years ago, and when we moved to Rails, we
  # added the updated_at/created_at fields, but never went back and cleaned up the data.
  # looking at the ratings table,
  # Rating id 464585	has empty values:	0000-00-00 00:00:00	0000-00-00 00:00:00
  # Rating id 464589	has populated values	2016-12-15 16:22:42	2016-12-15 16:22:42
  # So, we are choosing 2016-12-14 0:00:00 as the new default time.
  # This is to prevent some old cases from puking, specifically around ratings.

  def change
    cases = Case.where(created_at: nil)
    cases.each do |kase|
      if kase.case_name.blank?
        kase.case_name = 'BLANK'
      end
      kase.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      kase.save!
    end
    cases = Case.where(updated_at: nil)
    cases.each do |kase|
      if kase.case_name.blank?
        kase.case_name = 'BLANK'
      end
      kase.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      kase.save!
    end


    queries_to_destroy = Query.where(case_id: nil)
    queries_to_destroy.each do |query|
      query.destroy!
    end

    queries = Query.where(created_at: nil)
    queries.each do |query|
      if query.query_text.blank?
        query.query_text = 'BLANK'
      end
      query.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      query.save!
    end
    queries = Query.where(updated_at: nil)
    queries.each do |query|
      if query.query_text.blank?
        query.query_text = 'BLANK'
      end
      query.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      query.save!
    end

    ratings_to_destroy = Rating.where(query_id: nil)
    ratings_to_destroy.each do |rating|
      rating.destroy!
    end

    ratings = Rating.where(created_at: nil)
    ratings.each do |rating|
      rating.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      rating.save!
    end
    ratings = Rating.where(updated_at: nil)
    ratings.each do |rating|
      rating.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      rating.save!
    end

    snapshots = Snapshot.where(created_at: nil)
    snapshots.each do |snapshot|
      snapshot.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      snapshot.save!
    end
    snapshots = Snapshot.where(updated_at: nil)
    snapshots.each do |snapshot|
      snapshot.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      snapshot.save!
    end

    teams = Team.where(created_at: nil)
    teams.each do |team|
      team.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      team.save!
    end
    teams = Team.where(updated_at: nil)
    teams.each do |snapshot|
      team.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      team.save!
    end

    tries = Try.where(created_at: nil)
    tries.each do |atry|
      atry.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      atry.save!
    end

    tries = Try.where(updated_at: nil)
    tries.each do |atry|
      atry.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      atry.save!
    end

    users = User.where(created_at: nil)
    users.each do |user|
      user.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      user.save!
    end

    users = User.where(updated_at: nil)
    users.each do |user|
      user.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      user.save!
    end

    scorers = Scorer.where(created_at: nil)
    scorers.each do |scorer|
      scorer.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      scorer.save!
    end

    scorers = Scorer.where(updated_at: nil)
    scorers.each do |scorer|
      scorer.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      scorer.save!
    end

    cvs = CuratorVariable.where(created_at: nil)
    cvs.each do |cv|
      cv.created_at = Time.new(2016, 12, 14, 0, 0, 0)
      cv.save!
    end

    cvs = CuratorVariable.where(updated_at: nil)
    cvs.each do |cv|
      cv.updated_at = Time.new(2016, 12, 14, 0, 0, 0)
      cv.save!
    end


    scores_to_destroy = Score.where(try_id: nil)
    scores_to_destroy.each do |score|
      score.destroy!
    end

    # remnant of the unit test style scorer.
    scores_to_destroy = Score.where(try_id: 0)
    scores_to_destroy.each do |score|
      score.destroy!
    end

    scores = Score.where(updated_at: nil)
    scores.each do |s|
      s.updated_at = s.created_at
      s.save!
    end


  end
end

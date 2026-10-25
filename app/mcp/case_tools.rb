# frozen_string_literal: true

class CaseTools < QuepidToolset
  tool :create_case, writes: true, description: 'Create a case (with its first try) owned by you' do
    param :case_name, :string, required: true
    param :scorer_id, :integer, desc: 'scorer to grade with; default: your default scorer'
    param :book_id, :integer, desc: 'book the case draws judgements from'
  end

  def create_case case_name:, scorer_id: nil, book_id: nil
    kase = current_user.cases.build(case_name: case_name)
    kase.scorer = find_scorer(scorer_id) if scorer_id
    kase.book = find_book(book_id) if book_id
    save! kase
    track { Analytics::Tracker.track_case_created_event current_user, kase, 1 == current_user.cases.count }
    case_json kase
  end

  tool :update_case, writes: true, description: 'Rename a case, or change its scorer, book or nightly flag' do
    param :case_id, :integer, required: true
    param :case_name, :string
    param :scorer_id, :integer
    param :book_id, :integer, desc: '0 detaches the book'
    param :nightly, :boolean
  end

  def update_case case_id:, case_name: nil, scorer_id: nil, book_id: nil, nightly: nil
    kase = find_case(case_id)
    kase.case_name = case_name unless case_name.nil?
    kase.scorer = find_scorer(scorer_id) unless scorer_id.nil?
    kase.book = book_id.to_i.zero? ? nil : find_book(book_id) unless book_id.nil?
    kase.nightly = nightly unless nightly.nil?
    save! kase
    track { Analytics::Tracker.track_case_updated_event current_user, kase }
    case_json kase
  end

  tool :archive_case, writes: true, description: 'Archive a case (hidden in the UI, can be unarchived later)' do
    param :case_id, :integer, required: true
  end

  def archive_case case_id:
    kase = find_case(case_id)
    kase.owner = current_user
    kase.mark_archived!
    track { Analytics::Tracker.track_case_archived_event current_user, kase }
    case_json kase
  end

  tool :unarchive_case, writes: true, description: 'Restore an archived case' do
    param :case_id, :integer, required: true
  end

  def unarchive_case case_id:
    kase = current_user.cases.find_by(id: case_id) or raise "Case #{case_id} not found"
    kase.archived = false
    save! kase
    case_json kase
  end

  tool :share_case_with_team, writes: true, description: 'Share a case with one of your teams' do
    param :case_id, :integer, required: true
    param :team_id, :integer, required: true
  end

  def share_case_with_team case_id:, team_id:
    kase = find_case(case_id)
    team = current_user.teams.find_by(id: team_id) or raise "Team #{team_id} not found"
    unless team.cases.exists?(kase.id)
      team.cases << kase
      track { Analytics::Tracker.track_case_shared_event current_user, kase, team }
    end
    { case_id: kase.id, team_id: team.id, shared: true }
  end

  tool :unshare_case_from_team, writes: true, description: 'Stop sharing a case with one of your teams' do
    param :case_id, :integer, required: true
    param :team_id, :integer, required: true
  end

  def unshare_case_from_team case_id:, team_id:
    kase = find_case(case_id)
    team = current_user.teams.find_by(id: team_id) or raise "Team #{team_id} not found"
    team.cases.delete(kase)
    { case_id: kase.id, team_id: team.id, shared: false }
  end

  private

  def case_json kase
    kase.as_json(only: [ :id, :case_name, :scorer_id, :book_id, :owner_id, :archived, :nightly,
                         :last_try_number, :created_at, :updated_at ])
  end
end

# frozen_string_literal: true

class BookTools < QuepidToolset
  tool :create_book, writes: true, description: 'Create a book owned by you, with the rating scale of a scorer' do
    param :name, :string, required: true
    param :scorer_id, :integer, required: true, desc: 'scorer whose scale the book is judged on'
    param :team_id, :integer, desc: 'share the book with this team'
    param :support_implicit_judgements, :boolean
    param :show_rank, :boolean
  end

  def create_book name:, scorer_id:, team_id: nil, support_implicit_judgements: nil, show_rank: nil
    scorer = find_scorer(scorer_id)
    book = current_user.books.build(name: name, scale: scorer.scale, scale_with_labels: scorer.scale_with_labels)
    book.support_implicit_judgements = support_implicit_judgements unless support_implicit_judgements.nil?
    book.show_rank = show_rank unless show_rank.nil?
    if team_id
      team = current_user.teams.find_by(id: team_id) or raise "Team #{team_id} not found"
      book.teams << team
    end
    save! book
    book_json book
  end

  tool :update_book, writes: true, description: "Change a book's name, guidelines or flags" do
    param :book_id, :integer, required: true
    param :name, :string
    param :scoring_guidelines, :string
    param :support_implicit_judgements, :boolean
    param :show_rank, :boolean
    param :archived, :boolean
  end

  # Only the declared parameters reach here (see RorMcp::Toolset.run).
  def update_book book_id:, **attributes
    book = find_book(book_id)
    book.assign_attributes(attributes.compact)
    save! book
    book_json book
  end

  tool :share_book_with_team, writes: true, description: 'Share a book with one of your teams' do
    param :book_id, :integer, required: true
    param :team_id, :integer, required: true
  end

  def share_book_with_team book_id:, team_id:
    book = find_book(book_id)
    team = current_user.teams.find_by(id: team_id) or raise "Team #{team_id} not found"
    team.books << book unless team.books.exists?(book.id)
    { book_id: book.id, team_id: team.id, shared: true }
  end

  private

  def book_json book
    book.as_json(only: [ :id, :name, :owner_id, :scale, :scale_with_labels, :scoring_guidelines,
                         :support_implicit_judgements, :show_rank, :archived, :created_at, :updated_at ])
  end
end

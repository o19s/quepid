# frozen_string_literal: true

module BooksHelper
  # Returns AI judges that are available to add to this book
  # (AI judges that belong to the book's teams but aren't already assigned to the book)
  def available_ai_judges_for_book(book)
    return User.none if book.teams.empty?
    
    # Get all AI judges from the book's teams
    team_ai_judges = User.only_ai_judges
                        .joins(:teams)
                        .where(teams: { id: book.teams.pluck(:id) })
                        .distinct
    
    # Exclude AI judges already assigned to this book
    team_ai_judges.where.not(id: book.ai_judges.pluck(:id))
  end

  # Returns true if there are AI judges available to add to this book
  def has_available_ai_judges_for_book?(book)
    available_ai_judges_for_book(book).exists?
  end
end
# frozen_string_literal: true

# Helper methods for book-related views
module BooksHelper
  # Generate options for scorer dropdown with unique scale combinations
  # @param user [User] The user to get scorers for
  # @return [Array] Array of [display_text, scorer_id] pairs for select options
  def scorer_options_for_select user
    # Get unique scale combinations - only need one scorer per combination
    unique_options = []
    seen_combinations = Set.new

    user.scorers_involved_with.pluck(:id, :scale, :scale_with_labels).each do |id, scale, scale_with_labels|
      combination_key = [ scale, scale_with_labels ]

      next if seen_combinations.include?(combination_key)

      display_text = format_scorer_scale_display(scale, scale_with_labels)
      unique_options << [ display_text, id ]
      seen_combinations.add(combination_key)
    end

    unique_options
  end

  # Find a scorer ID that matches the book's current scale and labels
  # @param user [User] The user to search scorers for
  # @param book [Book] The book to find matching scorer for
  # @return [Integer, nil] The scorer ID that matches, or nil if no match
  def matching_scorer_id_for_book user, book
    return nil if book&.scale.blank?

    # Use manual search because find_by doesn't work well with serialized columns
    matching_scorer = user.scorers_involved_with.find do |scorer|
      scorer.scale == book.scale && scorer.scale_with_labels == book.scale_with_labels
    end

    matching_scorer&.id
  end

  # Format a scorer's scale and labels for display
  # @param scale [Array] The scale array (e.g., [0, 1, 2, 3])
  # @param scale_with_labels [Hash] The labels hash (e.g., {"0" => "Poor", "1" => "Fair"})
  # @return [String] Formatted display text
  def format_scorer_scale_display scale, scale_with_labels
    scale_display = scale.present? ? scale.join(',') : 'No scale'

    labels_preview = if scale_with_labels.present? && scale_with_labels.any?
                       first_two_labels = scale_with_labels.values.first(2).join(', ')
                       ellipsis = scale_with_labels.size > 2 ? '...' : ''
                       " (#{first_two_labels}#{ellipsis})"
                     else
                       ''
                     end

    "#{scale_display}#{labels_preview}"
  end

  # Returns AI judges that are available to add to this book
  # (AI judges that belong to the book's teams but aren't already assigned to the book)
  def available_ai_judges_for_book book
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
  def available_ai_judges_for_book? book
    available_ai_judges_for_book(book).exists?
  end
end

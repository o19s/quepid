# frozen_string_literal: true

# Helper methods for judgement-related views
module JudgementHelper
  # Generate rating buttons based on the book's scorer
  # @param book [Book] The book containing the scorer
  # @return [Array] Array of button configuration hashes, with :use_backup_labels indicating if fallbacks were used
  # rubocop:disable Metrics/MethodLength, Metrics/BlockLength
  def generate_rating_buttons book
    max_score = book.scorer.scale.max

    buttons = book.scorer.scale.map do |score|
      # Create the basic button with value and calculated properties
      button = {
        'value'        => score.to_s,
        'label'        => score.to_s,
        'label_backup' => score.to_s, # Always store backup
        'key'          => calculate_keyboard_key(score),
      }

      # Calculate appropriate button class based on scale position
      button['class'] = calculate_button_class(score, max_score)

      # Add HSL color to match Angular app
      button['style'] = { 'background-color' => calculate_hsl_color(score, book.scorer.scale) }

      # Get label from scorer if available
      begin
        score_str = score.to_s
        scorer_label = begin
          book.scorer.scale_with_labels[score_str]
        rescue StandardError
          nil
        end
        if scorer_label.present?
          button['label'] = scorer_label
        else
          # No label from scorer, using fallback
          true
        end
      rescue StandardError
        button['label'] = ''
        true
      end

      # If label is blank, use the backup
      if button['label'].blank?
        button['label'] = button['label_backup']
        true
      end

      button
    end

    # Return both the buttons and whether fallbacks were used
    buttons
  end
  # rubocop:enable Metrics/MethodLength, Metrics/BlockLength

  # Calculate the CSS class for a rating button based on its score
  # @param score [Integer] The rating value
  # @param max_score [Integer] The maximum possible score
  # @return [String] CSS class for the button
  def calculate_button_class score, max_score
    if score.zero?
      'btn-danger'  # Red for lowest score
    elsif score < (max_score / 3.0)
      'btn-warning' # Yellow for low scores
    elsif score < (2 * max_score / 3.0)
      'btn-info'    # Blue for medium scores
    else
      'btn-success' # Green for high scores
    end
  end

  # Calculate HSL color value matching the Angular app's color scheme
  # This replicates the same color gradient from the Angular app (ScorerFactory.js)
  # where scores range from red (lowest) to green (highest) on a 0-120 hue scale
  # @param score [Numeric] The rating value
  # @param scale [Array] The full scale array from the scorer
  # @return [String] HSL color string
  def calculate_hsl_color score, scale
    # Match the Angular app's color calculation logic from scaleToColors function
    min_score = scale.first
    max_score = scale.last
    range = max_score - min_score

    # Calculate hue (0-120 from red to green, just like the Angular app)
    hue = if range.zero?
            0 # Avoid division by zero
          else
            ((score.to_f - min_score) * 120 / range).round
          end

    # Return HSL color string
    "hsl(#{hue}, 100%, 50%)"
  end

  # Calculate keyboard shortcut key for a rating value
  # @param score [Integer] The rating value
  # @param max_score [Integer, nil] Maximum possible score, used for compatibility
  # @return [Hash] Keyboard shortcut information
  def calculate_keyboard_key score, _max_score = nil
    # Map scores 0-9 to keys a-l (skipping i)
    keys = %w[a s d f g h j k l sc]

    # Convert score to integer if it's a string
    score = score.to_i if score.respond_to?(:to_i)

    # Handle out-of-range scores
    if score > 9
      score = 9 # Cap at 9
    end

    # Guard against negative or nil scores
    return nil if score.nil? || score.negative? || score >= keys.length

    # Get the key for this score
    key = keys[score]

    # Return in format compatible with existing code
    {
      name:         key,
      display_name: key.upcase,
    }
  end
end

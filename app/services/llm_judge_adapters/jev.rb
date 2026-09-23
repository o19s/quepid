# frozen_string_literal: true

module LlmJudgeAdapters
  # TypeSafe's Jev: a typed evaluation model rather than a chat model. It is
  # handed a state and typed questions and answers with a rating, a probability
  # distribution and a confidence -- never prose, and never a value outside the
  # criteria it was given.
  #
  # The consequences for a judge: the book's scale *is* the request (as the
  # question's criteria), the answer is a position on that scale rather than a
  # number the model picked, and the explanation has to be built from the
  # distribution because the model writes none.
  class Jev < Base
    QUESTION_ID = 'relevance'
    DEFAULT_MODEL = 'jev-latest'

    # A score question takes 2..10 ordered levels; a longer scale is asked as a
    # choice between the rating values instead (up to 255 options).
    MAX_SCORE_LEVELS = 10

    # Jev's limit is 64k tokens for the whole request and 32k for the state plus
    # the longest question. Cap what we send rather than letting the API 422.
    MAX_FIELD_CHARS = 4_000
    MAX_STATE_CHARS = 80_000
    TRUNCATION_MARKER = ' ...[truncated]'

    NO_BOOK_MESSAGE = 'Jev judges against a book\'s rating scale, so it needs a book -- open the prompt ' \
                      'preview with a book (?book_id=...) or run the judge from a book.'

    def path
      'v1/systemone'
    end

    # Overridden rather than filling in Base's body_for: for a chat model the
    # book is context that colours a prompt, but here the book's scale *is* the
    # question, so it has to reach the request builder as an argument.
    def request_envelope query_doc_pair, system_prompt:, book: nil
      {
        path:    path,
        headers: headers,
        body:    {
          model:     options[:llm_model].presence || DEFAULT_MODEL,
          state:     user_prompt(query_doc_pair),
          questions: { QUESTION_ID => question(system_prompt, book) },
        },
      }
    end

    # The prompt-preview path can build a request from a loose prompt pair with
    # no book attached. Nothing sensible can be asked of Jev that way, so say so
    # instead of sending a question with no criteria.
    def envelope _user_prompt, _system_prompt
      raise NO_BOOK_MESSAGE
    end

    # Jev accepts text only -- a string, a JSON object, or an array of text
    # values -- so a document's image field travels as the URL it is, and is
    # not fetched. Objects beat serialized strings here: the field names stay
    # visible to the model.
    def user_prompt query_doc_pair
      state = {
        query:            query_doc_pair.query_text,
        information_need: query_doc_pair.information_need.presence,
        document:         truncated_fields(query_doc_pair.document_fields),
      }.compact

      cap_state(state)
    end

    # Unlike a chat model's answer, Jev's cannot be off-scale: `score` is a
    # position on the criteria we supplied, so it maps back to one of the
    # book's own rating values.
    def apply_response judgement, response_body, book: nil
      answer = answer_from(response_body)
      scale = JudgeScale.for(book)

      judgement.rating = rating_from(answer, scale)
      judgement.explanation = explanation_from(answer, response_body, scale)

      # Two answers can share a score and mean very different things, so a run
      # can be told to treat a flat distribution as no answer at all.
      judgement.mark_unrateable if below_confidence_floor?(answer)

      judgement
    end

    private

    def question system_prompt, book
      raise NO_BOOK_MESSAGE if book.nil?

      scale = JudgeScale.for(book)

      raise 'Jev judges against the book\'s rating scale, but this book has no scale configured' if scale.empty?

      type, criteria = if scale.size > MAX_SCORE_LEVELS
                         [ 'choice', scale.criteria_by_value ]
                       else
                         [ 'score', scale.criteria ]
                       end

      { type: type, instructions: instructions(system_prompt, book), criteria: criteria }
    end

    # The judge's own prompt still says what to weigh; it just no longer has to
    # describe the scale or an output format, both of which the request carries.
    def instructions system_prompt, book
      [ system_prompt.presence, book&.scoring_guidelines.presence ].compact.join("\n\n")
    end

    def answer_from response_body
      answer = response_body.to_h.dig('answers', QUESTION_ID)
      raise "Jev returned no '#{QUESTION_ID}' answer: #{response_body.inspect}" if answer.blank?

      answer
    end

    def rating_from answer, scale
      return answer['choice'].to_f if 'choice' == answer['type']

      scale.value_for_level(answer['score'])&.to_f
    end

    def below_confidence_floor? answer
      floor = options[:jev_min_confidence]
      return false if floor.blank?

      answer['confidence'].to_f < floor.to_f
    end

    # Jev writes no prose, so say what it actually answered: the rating, the raw
    # position it came from, how sure it was, and where the rest of the
    # probability went. That is more reviewable than a chat model's rationale.
    def explanation_from answer, response_body, scale
      rating = rating_from(answer, scale)
      label = scale.label_for(rating&.to_i)
      described = label.present? ? "#{formatted(rating)} (#{label.inspect})" : formatted(rating)
      raw = 'choice' == answer['type'] ? nil : "raw score #{formatted(answer['score'])} of 0-#{scale.size - 1}, "

      "Jev rated #{described} -- #{raw}confidence #{formatted(answer['confidence'])}. " \
        "Distribution: #{distribution(answer, scale)}. (model #{response_body.to_h['model']})"
    end

    def distribution answer, scale
      probabilities = answer['probabilities']
      return 'not reported' if probabilities.blank?

      probabilities.map do |key, probability|
        value = 'choice' == answer['type'] ? key : scale.value_for_level(key)
        "#{value}: #{(probability.to_f * 100).round}%"
      end.join(', ')
    end

    def formatted number
      return 'unknown' if number.nil?

      format('%g', number)
    end

    def truncated_fields document_fields
      document_fields.to_h.transform_values { |value| truncate(value, MAX_FIELD_CHARS) }
    end

    def cap_state state
      serialized = state.to_json
      return state if serialized.length <= MAX_STATE_CHARS

      state.merge(document: truncate(state[:document].to_json, MAX_STATE_CHARS - serialized.length.digits.size))
    end

    def truncate value, limit
      text = value.is_a?(String) ? value : value.to_s
      return value if text.length <= limit

      "#{text[0, limit]}#{TRUNCATION_MARKER}"
    end
  end
end

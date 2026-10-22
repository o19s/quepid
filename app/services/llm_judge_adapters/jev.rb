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

    NO_SCALE_MESSAGE = 'Jev judges against a rating scale, so it needs one -- run it from a book that has a scale.'

    # The scale is sent as the question's criteria rather than described in the prompt,
    # so there is nothing to ask without one.
    def self.scale_as_criteria?
      true
    end

    def path
      'v1/systemone'
    end

    # Overridden rather than filling in Base's body_for: for a chat model the
    # scale is context that colours a prompt, but here the scale *is* the
    # question, so it has to reach the request builder as an argument.
    def request_envelope query_doc_pair, system_prompt:, scale: JudgeScale::NONE
      {
        path:    path,
        headers: headers,
        body:    {
          model:     options[:llm_model].presence || DEFAULT_MODEL,
          state:     user_prompt(query_doc_pair),
          questions: { QUESTION_ID => question(system_prompt, scale) },
        },
      }
    end

    # The prompt-preview path can build a request from a loose prompt pair with
    # no scale attached. Nothing sensible can be asked of Jev that way, so say so
    # instead of sending a question with no criteria.
    def envelope _user_prompt, _system_prompt
      raise NO_SCALE_MESSAGE
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
    # scale's own rating values.
    def apply_response judgement, response_body, scale: JudgeScale::NONE
      answer = answer_from(response_body)

      judgement.rating = rating_from(answer, scale)
      judgement.explanation = explanation_from(answer, response_body, scale)

      # Two answers can share a score and mean very different things, so a run
      # can be told to treat a flat distribution as no answer at all. Say so in
      # the explanation, which otherwise still reads "Jev rated 1": the
      # judgement is unrateable because of the floor, not the rating.
      if below_confidence_floor?(answer)
        judgement.mark_unrateable
        judgement.explanation = "#{judgement.explanation} [confidence #{answer['confidence']} is below this " \
                                "judge's minimum confidence of #{options[:jev_min_confidence]}, so it was " \
                                'marked unrateable]'
      end

      judgement
    end

    private

    def question system_prompt, scale
      raise NO_SCALE_MESSAGE if scale.empty?

      type, criteria = if scale.size > MAX_SCORE_LEVELS
                         [ 'choice', scale.criteria_by_value ]
                       else
                         [ 'score', scale.criteria ]
                       end

      { type: type, instructions: instructions(system_prompt, scale), criteria: criteria }
    end

    # The judge's own prompt still says what to weigh; it just no longer has to
    # describe the scale or an output format, both of which the request carries.
    def instructions system_prompt, scale
      [ system_prompt.presence, scale.guidelines ].compact.join("\n\n")
    end

    def answer_from response_body
      answer = response_body.to_h.dig('answers', QUESTION_ID)
      raise "Jev returned no '#{QUESTION_ID}' answer: #{response_body.inspect}" if answer.blank?

      answer
    end

    def rating_from answer, scale
      if 'choice' == answer['type']
        choice = numeric_value(answer['choice'])
        return choice if choice && scale.includes?(choice)

        return nil
      end

      score = numeric_value(answer['score'])
      scale.value_for_level(score)&.to_f if score
    end

    # Avoid String#to_f's permissive conversion (`"garbage".to_f == 0.0`),
    # which can turn a malformed provider answer into a valid lowest rating.
    def numeric_value value
      number = Float(value)
      number if number.finite?
    rescue ArgumentError, TypeError
      nil
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

    # Reports what came back, even when it is not a number -- a malformed answer
    # is exactly the kind worth being able to read in the explanation.
    def formatted value
      number = numeric_value(value)
      return format('%g', number) if number
      return 'unknown' if value.nil?

      value.to_s.inspect
    end

    def truncated_fields document_fields, limit = MAX_FIELD_CHARS
      document_fields.to_h.transform_values { |value| truncate(value, limit) }
    end

    # Shrinks the document fields (the only part of state large enough to matter)
    # by the state's actual overage, split evenly across fields, rather than
    # truncating by some fixed amount that ignores how far over the limit the
    # query/information_need push the whole state.
    def cap_state state
      serialized = state.to_json
      return state if serialized.length <= MAX_STATE_CHARS

      document = state[:document] || {}
      overage = serialized.length - MAX_STATE_CHARS
      per_field_limit = [ ((MAX_FIELD_CHARS * document.size) - overage) / [ document.size, 1 ].max, 0 ].max

      state.merge(document: truncated_fields(document, per_field_limit))
    end

    def truncate value, limit
      text = value.is_a?(String) ? value : value.to_s
      return value if text.length <= limit

      "#{text[0, limit]}#{TRUNCATION_MARKER}"
    end
  end
end

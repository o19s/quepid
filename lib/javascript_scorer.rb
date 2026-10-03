# frozen_string_literal: true

# Runs a Scorer's JavaScript on the server with the same runtime the case UI
# uses (app/javascript/utils/scorer_runtime.js), so a scorer gets the same
# helpers (docAt, avgRating100, pass, assert, ...) in both places.
class JavascriptScorer
  class ScoreError < StandardError; end

  RUNTIME_PATH = Rails.root.join('app/javascript/utils/scorer_runtime.js')

  # Adapts server-side plain hashes to the shapes the browser runtime expects:
  # docs are wrappers with hasRating()/getRating() whose `.doc` holds the fields.
  # MiniRacer drains the promise queue when an eval returns, so the result is
  # read back with a second eval.
  ADAPTER = <<~JS
    var scoreResult = null;
    function runScorer(input) {
      scoreResult = null;
      const scorer = createScorer({ code: input.code, scale: input.scale });
      const docs = input.docs.map(function(doc) {
        const rated = doc.rating !== undefined && doc.rating !== null;
        return {
          doc: doc,
          hasRating: function() { return rated; },
          getRating: function() { return rated ? doc.rating : null; }
        };
      });
      scorer.score(input.query, input.total, docs, input.bestDocs, input.options).then(function(score) {
        scoreResult = score === null ? { error: String(scorer.error) } : { score: score };
      });
    }
  JS

  def initialize
    @context = MiniRacer::Context.new
    @context.attach('puts', ->(message) { puts message })
    @context.eval('var console = { log: function(msg) { puts(msg); } };')
    # The runtime is an ES module; MiniRacer evaluates classic scripts.
    @context.eval(File.read(RUNTIME_PATH).gsub(/^export /, ''))
    @context.eval(ADAPTER)
  end

  # docs      - ranked search results: hashes with :id, :rating and any doc fields.
  # best_docs - every rated doc for the query, highest rating first: { id:, rating: }.
  # scale     - the scorer's rating scale; its last value is the scorer's `max`.
  # query     - optional :id, :total (numFound) and :options (qOption) of the query.
  #
  # Returns the numeric score, or nil when the scorer reported no score.
  def score docs, best_docs, scorer_code, scale: nil, query: {}
    input = {
      code:     scorer_code,
      scale:    scale.presence || [ 0, 1 ],
      docs:     docs,
      bestDocs: best_docs,
      query:    { queryId: query[:id], ratedDocs: [] },
      total:    query[:total] || docs.length,
      options:  query[:options],
    }
    @context.call('runScorer', input.as_json)
    result = @context.eval('scoreResult')

    raise ScoreError, 'Scorer finished without calling setScore, pass or fail' if result.nil?
    raise ScoreError, result['error'] if result['error']

    score = result['score']
    # "zsr" (no results) and "--" (no ratings) are display markers, not scores.
    score.is_a?(Numeric) ? smart_round(score) : nil
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end

  private

  def smart_round number
    # If the number has 2 or more decimal places, round to 2
    decimal_places = number.to_s.split('.')[1].to_s.length
    decimal_places >= 2 ? number.round(2) : number
  end
end

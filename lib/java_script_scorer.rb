# frozen_string_literal: true

class JavaScriptScorer
  class ScoreError < StandardError; end

  def initialize js_file_path
    @context = MiniRacer::Context.new

    # Add Ruby methods to JavaScript context
    attach_ruby_methods

    # Add console.log support
    @context.eval <<-JS
      var console = {
        log: function(msg) { puts(msg); }
      };
    JS

    # Load your scoring JavaScript
    @context.eval(File.read(js_file_path))
  end

  def score docs, _scorer_file_path
    # docs = docs.to_json
    @context.eval("docs = #{docs.to_json};")

    result = @context.eval(<<-JS)
        try {

        #{' '}
          console.log("Starting ");
          //console.log(docs)
          //scoreItems(items, options);  // Your JavaScript scoring function
          const k = 10; // @Rank
          // k may be > length list, so count up the total number of documents processed.
          let count = 0, total = 0;
          eachDoc(function(doc, i) {
              if (hasDocRating(i) && (docRating(i)) > 0) { // map 0 -> irrel, 1+ ->rel
                  count = count + 1;
              }
              total = total + 1.0;
          }, k);
          const score = total ? count / total : 0.0;
         // setScore(score);
         console.log("The score is " + score);
          score;

        } catch (error) {
          ({ error: error.message });
        }
    JS
    puts "the result is #{result}"
    raise ScoreError, result['error'] if result.is_a?(Hash) && result['error']

    result
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end

  def score_items items, options = {}
    # Convert Ruby objects and options to JavaScript
    js_items = items.to_json
    js_options = options.to_json

    puts "js_itmes is made: #{js_items}"
    puts "js_options is made: #{js_options}"

    result = @context.eval(<<-JS)
        try {
          const items = #{js_items};
          const options = #{js_options};
          console.log("Hello World");
          //{bob:true};
          console.log(items)
          scoreItems(items, options);  // Your JavaScript scoring function
        } catch (error) {
          ({ error: error.message });
        }
    JS
    puts "the result is #{result}"
    raise ScoreError, result['error'] if result.is_a?(Hash) && result['error']

    result
  rescue MiniRacer::Error => e
    raise ScoreError, "JavaScript execution error: #{e.message}"
  end

  private

  def attach_ruby_methods
    @context.attach('puts', ->(message) { puts message })

    # Expose Ruby methods to JavaScript
    @context.attach('rubyLog', ->(message) { puts(message) })

    # Add more Ruby methods as needed
    @context.attach('fetchData', ->(id) {
      Data.find(id).to_json
    })
  end
end

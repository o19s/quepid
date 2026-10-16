# frozen_string_literal: true

require 'test_helper'
require 'javascript_scorer'

class ScoringTest < ActiveSupport::TestCase
  describe 'Samples' do
    let(:asnapshot) { snapshots(:a_snapshot) }

    it 'calculates some numbers' do
      # MiniRacer::Platform.set_flags!(:single_threaded)

      context = MiniRacer::Context.new
      context.eval('var adder = (a,b)=>a+b;')
      assert_equal 42, context.eval('adder(20,22)')

      context = MiniRacer::Context.new
      context.attach('math.adder', proc { |a, b| a + b })
      assert_equal 42, context.eval('math.adder(20,22)')
    end

    it 'handles P@10' do
      javascript_scorer = JavascriptScorer.new

      # Prepare some items to score
      docs = [
        { id: 1, value: 10, rating: 3 },
        { id: 2, value: 20, rating: 0 }
      ]

      best_docs = []
      # Calculate score with options
      # begin
      code = File.read(Rails.root.join('db/scorers/p@10.js'))
      score = javascript_scorer.score(docs, best_docs, code)
      assert_in_delta(0.5, score)
      # rescue JavascriptScorer::ScoreError => e
      # puts "Scoring failed: #{e.message}"
      # end
    end
  end
end

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

    it 'reads in a ascorer' do
      scorer = JavascriptScorer.new(Rails.root.join('db/scorers/scoring_logic.js'))

      # Prepare some items to score
      items = [
        { id: 1, value: 10 },
        { id: 2, value: 20 }
      ]

      # Calculate score with options
      begin
        score = scorer.score_items(items, {
          multiplier: 1.5,
          dataId:     123,
        })
        puts "Final score: #{score}"
        assert_equal 45, score
      rescue JavaScriptScorer::ScoreError => e
        puts "Scoring failed: #{e.message}"
      end
    end

    it 'handles P@10' do
      java_script_scorer = JavascriptScorer.new(Rails.root.join('db/scorers/scoring_logic.js'))

      # Prepare some items to score
      items = [
        { id: 1, value: 10, rating: 3 },
        { id: 2, value: 20, rating: 0 }
      ]

      # Calculate score with options
      begin
        score = java_script_scorer.score(items, Rails.root.join('db/scorers/p@10.js'))
        puts "Final score: #{score}"
        assert_equal 0.5, score
      rescue JavaScriptScorer::ScoreError => e
        puts "Scoring failed: #{e.message}"
      end
    end
  end
end

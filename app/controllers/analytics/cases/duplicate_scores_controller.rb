# frozen_string_literal: true

module Analytics
  module Cases
    class DuplicateScoresController < ApplicationController
      before_action :set_case, only: [ :show ]

      def show
        @duplicate_score_patterns = Score.select([ 'count(*) as count', :try_id, :all_rated, :score, :queries ])
          .where(case_id: @case.id)
          .scored.group(
            :try_id, :all_rated, :score, :queries
          ).having('COUNT(*) > 1')
      end
    end
  end
end

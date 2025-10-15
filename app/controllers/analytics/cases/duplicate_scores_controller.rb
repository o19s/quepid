# frozen_string_literal: true

module Analytics
  module Cases
    class DuplicateScoresController < ApplicationController
      before_action :set_case, only: [ :show ]

      def show
        @duplicate_score_patterns = Score.select([ 'count(*) as count', :try_id, :score, 'DATE(updated_at) AS day' ])
          .where(case_id: @case.id)
          .scored.group(
            :try_id, :score, 'day'
          ).having('COUNT(*) > 0')
          .order(day: :desc)
      end
    end
  end
end

# script for finding and clearing out all the duplicate scores.
#

# Case.all.find_each do |kase|
#   puts "Here we go for Case #{kase.id}, #{kase.case_name}"
#   @duplicate_score_patterns = Score.select([ 'count(*) as count', :try_id, 'DATE(updated_at) AS day' ])
#     .where(case_id: kase.id)
#     .scored.group(
#       :try_id, 'day'
#     ).having('COUNT(*) > 1')

#   @duplicate_score_patterns.each do |dsp|
#     puts "try #{dsp.try_id} on #{dsp.day}: #{dsp.count}"
#   end

#   @duplicate_score_patterns.each do |dsp|
#     puts "#{dsp.day}: #{dsp.count}, #{dsp.try_id}"
#     scores = Score.where(case_id: kase.id).where(try_id: dsp.try_id).where('DATE(updated_at) = :day', day: dsp.day )
#     latest_score = scores.max_by(&:updated_at)
#     Score.where(case_id: kase.id).where(try_id: dsp.try_id)
#       .where('DATE(updated_at) = :day', day: dsp.day )
#       .where.not(id:latest_score.id)
#       .delete_all
#   end
# end

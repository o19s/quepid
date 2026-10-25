# frozen_string_literal: true

json.partial! 'team', team: @team, load_cases: @load_cases, shallow: false, sampled_case_scores: @sampled_case_scores

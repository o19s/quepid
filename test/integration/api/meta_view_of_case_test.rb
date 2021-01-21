# frozen_string_literal: true

require 'test_helper'

class MetaViewOfCaseTest < ActionDispatch::IntegrationTest
  include ActionMailer::TestHelper
  let(:owner)                 { users(:team_owner) }
  let(:member1)               { users(:team_member_1) }
  let(:member2)               { users(:team_member_2) }
  let(:matt)                  { users(:matt) }
  let(:team)                  { teams(:team_owner_team) }
  let(:matt_case)             { cases(:matt_case) }

  test 'Look at a case, and product some quality metrics of the case and its ratings' do
    # Let's set up the case.
    post users_login_url params: { email: owner.email, password: 'password', format: :json }
    post api_team_members_url(team), params: { id: matt.id }
    post api_team_cases_url(team), params: { id: matt_case.id }

    matt_case.scorer = Scorer.find_by(name: 'CG@10')
    matt_case.save!

    queries_texts = %w[frog duck]
    queries_texts.each do |query_text|
      post api_case_queries_url(matt_case), params: { query: { query_text: query_text } }
    end

    # for each of the two queries, we rate 3 deep
    # owner rates 0's
    # member1 rates 1's
    # member2 rates 2's
    rating_value = 0
    raters = [ owner, member1, member2 ]
    raters.each do |rater|
      matt_case.queries.each do |query|
        (1..3).each do |doc_counter|
          put api_case_query_ratings_url(matt_case, query),
              params: { rating: { doc_id: "doc_#{query.query_text}_#{doc_counter}", user_id: rater.id,
rating: rating_value } }
        end
      end
      rating_value += 1
    end

    query = matt_case.queries.first
    put api_case_query_ratings_url(matt_case, query),
        params: { rating: { doc_id: "doc_#{query.query_text}_1", user_id: member2.id, rating: 1 } }

    Bullet.enable = false # I don't understand the Bullet notification, so just disable it.
    post api_case_queries_url(matt_case), params: { query: { query_text: 'parrot' } }
    Bullet.enable = true

    matt_case.reload
    query = matt_case.queries.first { |q| 'parrot' == q.query_text }

    put api_case_query_ratings_url(matt_case, query),
        params: { rating: { doc_id: "doc_#{query.query_text}_1", user_id: member2.id, rating: 1 } }

    matt_case.reload

    max_label = matt_case.scorer.scale.last

    case_variance_values = []

    matt_case.queries.each do |q|
      next if q.ratings.empty?

      variance = Query.ratings_variance(q.ratings).first.rating # change rating to something else for Nate

      relative_variance = variance / max_label

      case_variance_values << relative_variance

      stoplight = if relative_variance.nan?
                    'hollow'
                  elsif relative_variance > 1.0
                    'red'
                  elsif relative_variance > 0.5
                    'yellow'
                  else
                    'green'
                  end
      # puts "stoplight for query #{q.query_text} is #{stoplight}"
    end

    # puts "Here is case variance: #{Query.mean(case_variance_values)}"
    assert Query.mean(case_variance_values).nan? # a single NaN at the query level makes case level NaN.
  end
end

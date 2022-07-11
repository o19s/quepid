# frozen_string_literal: true

class RatingChannel < ApplicationCable::Channel
  def subscribed
    # rubocop:disable Layout/LineLength
    # this is fun.  From straight up JS: {channel: 'RatingChannel', case:7} is {"channel"=>"RatingChannel", "case"=>7}
    # but in Angular ActionCable: {channel: 'RatingChannel', case:7} is {"channel"=>"RatingChannel", "data"=>{"case"=>7}}
    # rubocop:enable Layout/LineLength
    puts "I am in subscribed"
    case_id = params['data'].present? ? params['data']['case_id'] : params['case_id']

    stream_from "case-#{case_id}"
    # stream_for current_user
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end

  def self.rating_created_event current_case, current_user, rating
    puts "about to do a rating_created event for case #{current_case.id}"
    ActionCable.server.broadcast "case-#{current_case.id}", {
      user:     {
        name: current_user.name,
        id:   current_user.id,
      },
      query_id: rating.query.id,
    }
  end

  def self.rating_bulk_updated_event current_case, current_user, query
    ActionCable.server.broadcast "case-#{current_case.id}", {
      user:     {
        name: current_user.name,
        id:   current_user.id,
      },
      query_id: query.id,
    }
  end
end

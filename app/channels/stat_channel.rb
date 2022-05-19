class StatChannel < ApplicationCable::Channel
  def subscribed

    # this is fun.  From straight up JS: {channel: 'StatChannel', case:7} is {"channel"=>"StatChannel", "case"=>7}
    # but in Angular ActionCable: {channel: 'StatChannel', case:7} is {"channel"=>"StatChannel", "data"=>{"case"=>7}}
    puts "in sbuscribed."
    puts params
    case_id = params['data'].present? ? params['data']['case_id'] : params['case_id']
    puts "our case id is #{case_id}"


    stream_from "case-#{case_id}"
    #stream_for current_user
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end

  def caseupdate
  end

  def self.rating_created_event (current_case, current_user, rating)
    puts "ratins are in progress"
    ActionCable.server.broadcast "case-#{current_case.id}", {
      user: {
        name: current_user.name,
        id: current_user.id
      },
      query_id: rating.query.id
    }
  end

  def self.rating_bulk_updated_event (current_case, current_user, query)
    puts "rating_bulk_updated_event"
    ActionCable.server.broadcast "case-#{current_case.id}", {
      user: {
        name: current_user.name,
        id: current_user.id
      },
      query_id: query.id
    }
  end

  def ratingsdone
  end
end

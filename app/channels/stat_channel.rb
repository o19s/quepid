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

  def ratingsinprogress
    puts "ratins are in progress"
  end

  def ratingsdone
  end
end

# frozen_string_literal: true

class QompanionChannel < ApplicationCable::Channel
  def subscribed
    user_id = params['data'].present? ? params['data']['user_id'] : params['user_id']
    puts "New subscription #{user_id}"
    stream_from stream_name(user_id) 
  end

  def unsubscribed

  end

  def query_complete data
    ActionCable.server.broadcast "remote_query_#{data['case_id']}", {
      type: 'complete', 
      query_id: data['query_id'],
      resp: data['resp']
    }
  
  end

  def stream_name user_id
    return "qompanion_#{user_id}"
  end

end

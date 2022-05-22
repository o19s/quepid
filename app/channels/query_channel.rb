# frozen_string_literal: true

class QueryChannel < ApplicationCable::Channel
  def subscribed
    puts "New subscription"
    case_id = params['data'].present? ? params['data']['case_id'] : params['case_id']
    stream_from stream_name(case_id) 
  end

  def unsubscribed

  end


  # Frontend will call this when it wants a set of queries
  def new_job params
    ActionCable.server.broadcast stream_name(params['message']), {
      type: 'new',
      case_id: params['message']
    }
  end

  # Executor will call this to let frontend know it's working
  def self.query_job_running case_id
    ActionCable.server.broadcast stream_name(case_id), {
      type: 'heartbeat'
    }
  end

  # 
  def self.query_job_complete case_id, payload
    ActionCable.server.broadcast stream_name(case_id), {
      type: 'complete',
      responses: payload
    }
  end

  private

  def stream_name case_id
    return "remote-query-#{case_id}"
  end

end

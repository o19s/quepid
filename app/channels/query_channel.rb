# frozen_string_literal: true

class QueryChannel < ApplicationCable::Channel
  def subscribed
    case_id = params['data'].present? ? params['data']['case_id'] : params['case_id']
    puts "New subscription #{case_id}"
    stream_from stream_name(case_id) 
  end

  def unsubscribed

  end


  # Frontend will call this when it wants a set of queries
  def new_job data
    puts "New job"
    ActionCable.server.broadcast "qompanion_#{data['message']['user_id']}", {
      type: 'new',
      case_id: data['message']['case_id'],
      href: data['message']['href'],
      query: data['message']['query'],
      query_id: data['message']['query_id'],
    }
  end

  # TODO: Use or delete
  # Executor will call this to let frontend know it's working
  def self.query_job_running case_id
    ActionCable.server.broadcast stream_name(case_id), {
      type: 'heartbeat'
    }
  end

  private

  def stream_name case_id
    return "remote_query_#{case_id}"
  end

end

class StatChannel < ApplicationCable::Channel
  def subscribed

    puts params
    stream_from "case-#{params["case"]}"
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

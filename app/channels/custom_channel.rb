# frozen_string_literal: true

class CustomChannel < ActionCable::Channel::Base
  extend Turbo::Streams::StreamName
  extend Turbo::Streams::Broadcasts
  include Turbo::Streams::StreamName::ClassMethods

  def subscribed
    if (stream_name = verified_stream_name_from_params).present? &&
       subscription_allowed?
      stream_from stream_name
    else
      reject
    end
  end

  def subscription_allowed?
    puts 'Is the subscription allowed?  Heck yeah'
    true
  end
end

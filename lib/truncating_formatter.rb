# frozen_string_literal: true

class TruncatingFormatter < ActiveSupport::Logger::SimpleFormatter
  def initialize limit: 5_000
    super()
    @limit = limit
  end

  def call severity, timestamp, progname, msg
    truncated_msg = msg.truncate(@limit)
    super(severity, timestamp, progname, truncated_msg)
  end
end

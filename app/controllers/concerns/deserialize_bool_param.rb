# frozen_string_literal: true

# Shared helper for query/body params that arrive as strings ("true", "false", "1", "0", etc.).
# Use in controllers: `deserialize_bool_param(params[:archived])` instead of ad-hoc string checks.
module DeserializeBoolParam
  extend ActiveSupport::Concern

  private

  def deserialize_bool_param param
    ActiveRecord::Type::Boolean.new.deserialize(param) || false
  end
end

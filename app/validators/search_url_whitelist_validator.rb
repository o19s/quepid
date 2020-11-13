# frozen_string_literal: true

class SearchUrlWhitelistValidator < ActiveModel::Validator
  def validate record
    return true if Rails.application.config.search_host_whitelist.empty?
    # TODO: extract host name from record.search_url (ignore protocol, port, path and other url components)
    # TODO: check if host is in Rails.application.config.search_host_whitelist
    return true
  end
end

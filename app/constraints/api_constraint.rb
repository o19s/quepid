# frozen_string_literal: true

class ApiConstraint
  def initialize options
    @version = options[:version]
    @default = options[:default]
  end

  def matches? request
    versioned_accept_header?(request) || @default
  end

  private

  def versioned_accept_header? request
    accept = request.headers['Accept']

    if accept
      mime_type, version = accept.gsub(/\s/, '').split(';')
      return mime_type.match(/vnd\.quepid\+json/) && "version=#{@version}" == version
    end

    false
  end
end

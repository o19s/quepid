# frozen_string_literal: true

namespace :db do
  desc 'Checks to see if the database exists'
  task exists: :environment do
    ActiveRecord::Base.connection
  rescue StandardError
    exit 1
  else
    exit 0
  end
end

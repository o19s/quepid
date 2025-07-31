#!/bin/sh
#set -e

echo "Checking if database exists..."
if bin/rails runner "ActiveRecord::Base.connection.execute('SELECT 1')" > /dev/null 2>&1; then
  echo "Database already exists, skipping creation..."
else
  echo "Database does not exist, creating and setting up..."
  bin/rake db:setup
fi

echo "Check DB migration status"
bin/rake db:migrate:status

echo "Starting migrations"
bin/rake db:migrate
echo "Completed migrations"

echo "Starting update asset path for context nesting"
#RAILS_ENV=production bundle exec rake assets:precompile RAILS_RELATIVE_URL_ROOT=/quepid-prod
#SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile RAILS_RELATIVE_URL_ROOT=/quepid-prod
echo "Completed update asset path"


#Startup CMD
foreman s -f Procfile

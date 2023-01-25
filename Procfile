web:    bundle exec puma -C config/puma.rb
#Disable the worker if you don't have Redis and Google Analytics set up.
worker: bundle exec sidekiq -e production -C config/sidekiq.yml -q default

web:    bundle exec puma -C config/puma.rb
# Enable the worker if you have Google Analytics set up.
worker: bundle exec sidekiq -e production -C config/sidekiq.yml -q default

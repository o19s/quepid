web:    bundle exec puma -C config/puma.rb
worker: bundle exec sidekiq -e production -C config/sidekiq.yml

# if we ever get rid of the worker process in Prod, we can remove foreman

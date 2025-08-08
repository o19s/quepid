# frozen_string_literal: true

namespace :rails_lens do
  desc 'Run rails_lens annotate and generate ERD after migrations'
  task :update => :environment do
    if Rails.env.development?
      puts 'Running rails_lens annotate...'
      system('bundle exec rails_lens annotate')

      puts 'Generating ERD diagram...'
      system('bundle exec rails_lens erd --output docs/diagrams')

      puts 'Rails lens updates completed!'
    else
      puts "Skipping rails_lens tasks in #{Rails.env} environment"
    end
  end
end

# Automatically run rails_lens after migrations in development
if Rails.env.development?
  Rake::Task['db:migrate'].enhance do
    Rake::Task['rails_lens:update'].invoke
  end
end

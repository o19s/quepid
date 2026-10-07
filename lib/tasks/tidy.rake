# frozen_string_literal: true

desc 'Check JavaScript formatting/lint, CSS and Ruby without modifying files'
task tidy: [ 'test:eslint', 'test:stylelint' ] do
  sh 'bundle', 'exec', 'rubocop', 'app', 'config', 'lib', 'test', 'Gemfile', 'Rakefile'
end

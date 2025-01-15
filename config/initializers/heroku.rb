# frozen_string_literal: true

# Unpack Jupyterlite on Heroku as part of start up
# See assets.rake for some related code.
puts "about to test out heroku."
if ENV['HEROKU_APP_NAME'].present?
  notebooks_gz = Rails.root.join('notebooks.gz')
  destination = Rails.public_path
  notebooks_dir = Rails.public_path.join('notebooks')
  unless File.exist?(notebooks_dir)
    puts "Unpacking Jupyterlite into #{destination}"
    #system "tar -xzf #{notebooks_gz} --directory #{destination}"
    system "tar -xzf #{notebooks_gz} --directory ./eric"

    File.delete(notebooks_gz)
  end
end

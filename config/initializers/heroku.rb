# frozen_string_literal: true

# Unpack Jupyterlite on Heroku as part of start up
# See assets.rake for some related code.
puts "about to test out heroku."
if ENV['HEROKU_APP_NAME'].present?
  notebooks_gz = Rails.root.join('notebooks.gz')
  destination = Rails.public_path
  notebooks_dir = Rails.public_path.join('notebooks')
  unless File.exist?(notebooks_dir)
    
    unless File.exist?(notebooks_gz)
      puts 'Downloading latest Quepid Notebooks from https://github.com/o19s/quepid-jupyterlite'
      system "wget --no-verbose -O #{notebooks_gz} https://github.com/o19s/quepid-jupyterlite/releases/latest/download/jupyter-lite-build.tgz"
    end
    
    puts "Unpacking Jupyterlite into #{destination}"
    #system "tar -xzf #{notebooks_gz} --directory #{destination}"
    system "tar -xzf #{notebooks_gz} --directory ./eric"

    File.delete(notebooks_gz)
  end
end

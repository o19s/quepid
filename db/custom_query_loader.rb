######################################
# Defaults
######################################

user_defaults = {
  administrator:    false,
  agreed:           true,
  agreed_time:      Time.now,
  first_login:       false,
  name:             'No Name',
  password:         'password',
  email:            'foo@example.com',
}

# seed user specifics

def seed_user hash
  if User.where(email: hash[:email].downcase).exists?
    User.where(email: hash[:email].downcase).first
  else
    User.create hash
  end
end

user_specifics = {
  name:             'Query Importer User',
  email:            'quepid+qimporter@o19s.com',
  password:         'quepid+qimporter',
}
user_params          = user_defaults.merge(user_specifics)
custom_queries_user = seed_user user_params

require 'csv'

if ENV['CUSTOM_QUERY']
  path = ENV['PATH']
  puts 'Loading custom queries from path=' + path

  # Ratings
  puts 'Seeding ratings................'

  rails_db = "#{Rails.root}/db/data/"
  puts rails_db
  files_list = Dir[rails_db + "*"]
  puts 'File list: ' + files_list.join(', ')

  # good to have for debugging purposes.
  # set this to some positive integer to control number of loaded query rows from the input CSV
  max_to_load = -1

  CSV.foreach(rails_db + path, :headers => true) do |row|
    if max_to_load == 0
      break
    end
    query = row['keyword']
    query_case = Case.new ({:user => custom_queries_user})
    query_case.update case_name: "'" + query[0..185] + "'"

    puts 'Creating case: ' + query_case.case_name

    opts    = {
      format:         :hash,
      force:          true,
      clear_existing: true,
    }

    # non-existent doc id: the point is to create a query in this case
    ratings = [
            { query_text: query,   doc_id: ' 720784-021190', rating: ' 5' }
          ]

    puts 'Importing query: ' + query

    ratings_importer = RatingsImporter.new query_case, ratings, opts
    ratings_importer.import
    max_to_load -= 1
  end

  puts 'Done loading queries'

end


module Trackable
  extend ActiveSupport::Concern
  
  def track_rating_created_event user, rating
    #Analytics::GoogleAnalytics.user_created_rating user, rating
    user_created_rating user, rating
  end
  
  #
  # Creates an event when a user creates a rating.
  #
  # @param user,      User
  # @param rating,    Rating
  #
  def user_created_rating _user, rating
    query = rating.query

    data = {
      category: 'Ratings',
      action:   'Rated a Query',
      label:    query.query_text,
      value:    rating.rating,
      bounce:   false,
    }

    create_event data
  end
  
  def create_event data
    ahoy.track "#{data[:category]} - #{data[:action]}", data
  end
end

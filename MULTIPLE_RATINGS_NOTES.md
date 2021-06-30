* The custom Struct for ratings is weird.
* DONE: Need a migration to assign ALL ratings to whoever owns the case.   
* DONE:  Need a migration to add the `case_view` column to cases.metadata.
* back out the average stuff on the rating view on updating it.
* When swapping between invidicual and consolidated, the front end UI doesn't refresh. --> We should probably just reload the entire case.
* When you share a case with a team, we need to refresh the component for "changes ratings view" in the front end
* Still a bug where sometimes tryNo in JS is 0, not 1!!!
* Think about moving the variances to something like /cases/case_id/analytics/variances end point, and introduce a case_analytics_controller.rb to deal with all of that!
* Change Struct for averaged rating to raturn decimal not integer.
* change the view from having a NaN to a "-" for unrated docs.
* Introduce the "Shared View" which is how things work today.
* decide if query/doc variance can be calculated with only 1 rating from 1 person.
* Case Variance theory:   split the colour based on multiple ratings per query and then the variance.  Do the colour chart, split half red and half green.
* add a number to the frogs for 1, 2, 3




# Saving for later

### view
json.ratings do
  query.ratings_averaged.each { |rating| json.set! rating.doc_id, rating.rating }
  Query.ratings_averaged(query.ratings).each { |rating| json.set! rating.doc_id, rating.rating }
end

### Test

describe "Lets check out the rating_views" do
           rating = {
             doc_id: 'x123z',
             rating: 14,
             user_id: nil
           }


           test "individual view returns individual rating" do
             put :update, params: { case_id: acase.id, query_id: query.id, rating: rating, ratings_view: 'individual' }
             assert_response :ok

             data = JSON.parse(response.body)
             assert_equal data['rating'],    14
           end

           test "average view returns averaged rating" do
             doc_id = 'x123z'
             query.ratings.create(doc_id: doc_id, rating: 1, user_id: doug.id)
             query.ratings.create(doc_id: doc_id, rating: 1, user_id: user.id)

             put :update, params: { case_id: acase.id, query_id: query.id, rating: rating, ratings_view: 'average' }
             assert_response :ok
             #byebug

             data = JSON.parse(response.body)
             assert_equal data['rating'],  5
           end

         end

### controller

def update
-          # user_id sometimes is nil and sometimes is populated
+          ratings_view  = params[:ratings_view] || :individual
+
+          # user_id sometimes is nil and sometimes is populated, and thats okay
  @rating = @query.ratings.find_or_create_by doc_id: @doc_id, user_id: rating_params[:user_id]

  if @rating.update rating_params
    Analytics::Tracker.track_rating_created_event current_user, @rating
-            respond_with @rating
+            if ratings_view == :individual
+              respond_with @rating
+            else
+              ratings_averaged   = Query.ratings_averaged(@query.ratings.where(doc_id: @doc_id))
+              require 'pp'
+              pp ratings_averaged
+              @rating = ratings_averaged.first
+              respond_with @rating
+            end
  else
    render json: @rating.errors, status: :bad_request
  end



## Discussion w/ Nate .


Do we show the case variance stop light in INDIVIDUAL mode?

If, when you change from CONSOLIDATED to INDIVIDUAL and back, maybe we just redirect you to the case and reload everything, versus trying to update in place????   I don't expect it to be super common changing, unlike say the show rated toggle.

Maybe if you start rating, we single the case variance stop light to become a hollow circle to indicate the data is out of date?


### Script for Demo

http://chorus.dev.o19s.com:4000/


http://app.quepid.com/case/4690/try/6?sort=default
Bring up Quepid with a case.   Let’s put in the Star Wars example.    Let’s pick P@4 for our scorer.

Demonstrate that we have lots of garbage Star Wars movies.   

Then tune it based on vote_count.   

So that was easy!

However, how do we scale this up for less specific results?


So, imagine that Kirk and Spock are transported to our universe, and discover that they are actors!

Imagine we ask them to rate their own movies...    How will they rate "Best Star Trek Movies" results?

Well, we know that Kirk is emotional, while Spock is logical..  So, that suggests that SPock will like the movies int he comedy and drama genres, and Spock will go for the Documentatrys!

So, lets up pull up a query with "star trek" and the query q=#$query##&defType=edismax&pf=title&qf=title&mm=100%





How about an e-commerce example, like "fancy coffee maker".   http://chorus.dev.o19s.com:4000/?search_field=default_algo&q=fancy+coffee+maker

Let's have Eric and Dmitry rate the case.

Now let's look at how we rated them.



To wrap up, we have a case with

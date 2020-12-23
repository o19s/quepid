* The custom Struct for ratings is weird.
* Need a migration to assign ALL ratings to whoever owns the case.   
* Need a migration to add the `case_view` column to cases.metadata.
* back out the average stuff on the rating view on updating it.





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

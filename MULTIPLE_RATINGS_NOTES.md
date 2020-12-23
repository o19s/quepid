* The custom Struct for ratings is weird.
* Need a migration to assign ALL ratings to whoever owns the case.   
* Need a migration to add the `case_view` column to cases.metadata.
* back out the average stuff on the rating view on updating it.





# Saving for later


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

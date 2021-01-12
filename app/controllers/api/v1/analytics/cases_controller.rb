module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        def show
          #puts "The current case has a ratings view of #{@case_metadatum.ratings_view}"
          respond_with @case
        end
    end
  end
end

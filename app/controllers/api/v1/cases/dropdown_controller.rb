# frozen_string_literal: true

module Api
  module V1
    module Cases
      class DropdownController < Api::ApiController
        def index
          @cases = recent_cases 4

          respond_with @cases
        end
      end
    end
  end
end

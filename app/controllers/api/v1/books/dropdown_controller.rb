# frozen_string_literal: true

module Api
  module V1
    module Books
      class DropdownController < Api::ApiController
        def index
          @books = recent_books 3

          respond_with @books
        end
      end
    end
  end
end

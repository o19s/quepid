# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        before_action :find_book
        before_action :check_book

        def show
        end
      end
    end
  end
end

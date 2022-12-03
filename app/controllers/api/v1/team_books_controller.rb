# frozen_string_literal: true

module Api
  module V1
    class TeamBooksController < Api::ApiController
      before_action :set_team,    only: [ :index, :create, :destroy ]
      before_action :check_team,  only: [ :index, :create, :destroy ]

      def index
        @books = @team.books
        respond_with @books
      end
    end
  end
end

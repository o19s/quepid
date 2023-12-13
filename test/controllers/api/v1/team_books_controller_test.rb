# frozen_string_literal: true

require 'test_helper'

module Api
  module V1
    class TeamBooksControllerTest < ActionController::TestCase
      let(:user)                  { users(:random) }
      let(:team)                  { teams(:shared) }
      let(:book1)                 { books(:book_of_star_wars_judgements) }
      let(:book2)                 { books(:james_bond_movies) }

      before do
        @controller = Api::V1::TeamBooksController.new

        login_user user
      end

      describe 'Lists all team books' do
        test "returns a list of all the team's books" do
          get :index, params: { team_id: team.id }

          assert_response :ok

          books = response.parsed_body['books']

          assert_instance_of  Array, books
          assert_equal        team.books.count, books.length

          ids = books.map { |book| book['id'] }

          assert_includes ids, book1.id
          assert_includes ids, book2.id
        end
      end
    end
  end
end

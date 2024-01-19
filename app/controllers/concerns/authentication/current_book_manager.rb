# frozen_string_literal: true

module Authentication
  module CurrentBookManager
    extend ActiveSupport::Concern

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
      TrackBookViewedJob.perform_later @book, current_user
    end

    def check_book
      render json: { message: 'Book not found!' }, status: :not_found unless @book
    end

    # rubocop:disable Metrics/MethodLength
    def recent_books count
      if current_user
        # Using joins/includes will not return the proper list in the
        # correct order because rails refuses to include the
        # `book_metadata`.`last_viewed_at` column in the SELECT statement
        # which will then cause the ordering not to work properly.
        # So instead, we have this beauty!
        sql = "
          SELECT  DISTINCT `books`.`id`, `book_metadata`.`last_viewed_at`
          FROM `books`
          LEFT OUTER JOIN `book_metadata` ON `book_metadata`.`book_id` = `books`.`id`
          LEFT OUTER JOIN `teams_books` ON `teams_books`.`book_id` = `books`.`id`
          LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_books`.`team_id`
          LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
          LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
          WHERE (`teams_members`.`member_id` = #{current_user.id} OR `books`.`owner_id` = #{current_user.id})
          ORDER BY `book_metadata`.`last_viewed_at` DESC, `books`.`id` DESC
          LIMIT #{count}
        "

        results = ActiveRecord::Base.connection.execute(sql)

        book_ids = []
        results.each do |row|
          book_ids << row.first.to_i
        end

        # map to objects
        # cases = Case.includes(:tries).where(id: [ case_ids ])
        books = Book.where(id: [ book_ids ])
        books = books.sort_by { |x| book_ids.index x.id }
      else
        books = []
      end
      books
    end
    # rubocop:enable Metrics/MethodLength
  end
end

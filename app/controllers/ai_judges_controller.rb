# frozen_string_literal: true

class AiJudgesController < ApplicationController
  def create
    @book = Book.find(params[:book_id])
    @user = User.find(params[:user_id])

    @ai_user = AiJudge.new(book: @book, user: @user)

    if @ai_user.save
      redirect_to @book, notice: 'User was successfully added as an AI Judge.'
    else
      render :new
    end
  end

  def destroy
    @ai_judge = User.find(params[:id])
    @book = Book.find(params[:book_id])
    @book.judge
    @ai_user.destroy
    redirect_to @ai_user.book, notice: 'AI Judge was successfully removed.'
  end
end

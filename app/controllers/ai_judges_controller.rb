# frozen_string_literal: true

class AiJudgesController < ApplicationController
  before_action :set_team, only: [ :new, :create, :destroy ]
  def new
    @ai_judge = User.new
  end

  def create
    @ai_judge = User.new(ai_judge_params)
    @ai_judge.password = SecureRandom.hex(8)

    if @ai_judge.save
      @team.members << @ai_judge
      @team.save
      redirect_to teams_core_path @team, notice: 'User was successfully added as an AI Judge to the Team.'
    else
      render :new
    end

    # @book = Book.find(params[:book_id])
    # @user = User.find(params[:user_id])

    # @ai_user = AiJudge.new(book: @book, user: @user)

    # if @ai_user.save
    #   redirect_to @book, notice: 'User was successfully added as an AI Judge.'
    # else
    #   render :new
    # end
  end

  def destroy
    @ai_judge = User.find(params[:id])
    @book = Book.find(params[:book_id])
    @book.judge
    @ai_user.destroy
    redirect_to @ai_user.book, notice: 'AI Judge was successfully removed.'
  end

  private

  def set_team
    @team = Team.find(params.expect(:team_id))
  end

  # Only allow a list of trusted parameters through.
  def ai_judge_params
    params.expect(user: [ :email, :name, :openai_key, :prompt ])
  end
end

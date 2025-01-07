class DudesController < ApplicationController
  before_action :set_ai_judge, only: %i[ show edit update destroy ]

  # GET /ai_judges or /ai_judges.json
  def index
    @ai_judges = Dude.all
  end

  # GET /ai_judges/1 or /ai_judges/1.json
  def show
  end

  # GET /ai_judges/new
  def new
    @ai_judge = User.new
  end

  # GET /ai_judges/1/edit
  def edit
  end

  # POST /ai_judges or /ai_judges.json
  def create
    @ai_judge = Dude.new(ai_judge_params)

    respond_to do |format|
      if @ai_judge.save
        format.html { redirect_to @ai_judge, notice: "Dude was successfully created." }
        format.json { render :show, status: :created, location: @ai_judge }
      else
        format.html { render :new, status: :unprocessable_entity }
        format.json { render json: @ai_judge.errors, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /ai_judges/1 or /ai_judges/1.json
  def update
    respond_to do |format|
      if @ai_judge.update(ai_judge_params)
        format.html { redirect_to @ai_judge, notice: "Dude was successfully updated." }
        format.json { render :show, status: :ok, location: @ai_judge }
      else
        format.html { render :edit, status: :unprocessable_entity }
        format.json { render json: @ai_judge.errors, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /ai_judges/1 or /ai_judges/1.json
  def destroy
    @ai_judge.destroy!

    respond_to do |format|
      format.html { redirect_to ai_judges_path, status: :see_other, notice: "Dude was successfully destroyed." }
      format.json { head :no_content }
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_ai_judge
      @ai_judge = Dude.find(params.expect(:id))
    end

    # Only allow a list of trusted parameters through.
    def ai_judge_params
      params.expect(ai_judge: [ :email, :name, :openai_key, :prompt ])
    end
end

require "test_helper"

class DudesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @ai_judge = ai_judges(:one)
  end

  test "should get index" do
    get ai_judges_url
    assert_response :success
  end

  test "should get new" do
    get new_ai_judge_url
    assert_response :success
  end

  test "should create ai_judge" do
    assert_difference("Dude.count") do
      post ai_judges_url, params: { ai_judge: { email: @ai_judge.email, name: @ai_judge.name, openai_key: @ai_judge.openai_key, prompt: @ai_judge.prompt } }
    end

    assert_redirected_to ai_judge_url(Dude.last)
  end

  test "should show ai_judge" do
    get ai_judge_url(@ai_judge)
    assert_response :success
  end

  test "should get edit" do
    get edit_ai_judge_url(@ai_judge)
    assert_response :success
  end

  test "should update ai_judge" do
    patch ai_judge_url(@ai_judge), params: { ai_judge: { email: @ai_judge.email, name: @ai_judge.name, openai_key: @ai_judge.openai_key, prompt: @ai_judge.prompt } }
    assert_redirected_to ai_judge_url(@ai_judge)
  end

  test "should destroy ai_judge" do
    assert_difference("Dude.count", -1) do
      delete ai_judge_url(@ai_judge)
    end

    assert_redirected_to ai_judges_url
  end
end

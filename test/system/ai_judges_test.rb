require "application_system_test_case"

class AiJudgesTest < ApplicationSystemTestCase
  setup do
    @ai_judge = ai_judges(:one)
  end

  test "should create ai_judge" do
    visit ai_judges_url
    click_on "New ai_judge"

    fill_in "Email", with: @ai_judge.email
    fill_in "Name", with: @ai_judge.name
    fill_in "Openai key", with: @ai_judge.openai_key
    fill_in "Prompt", with: @ai_judge.prompt
    click_on "Create Dude"

    assert_text "Dude was successfully created"
    click_on "Back"
  end

  test "should update Dude" do
    visit ai_judge_url(@ai_judge)
    click_on "Edit this ai_judge", match: :first

    fill_in "Email", with: @ai_judge.email
    fill_in "Name", with: @ai_judge.name
    fill_in "Openai key", with: @ai_judge.openai_key
    fill_in "Prompt", with: @ai_judge.prompt
    click_on "Update Dude"

    assert_text "Dude was successfully updated"
    click_on "Back"
  end

  test "should destroy Dude" do
    visit ai_judge_url(@ai_judge)
    click_on "Destroy this ai_judge", match: :first

    assert_text "Dude was successfully destroyed"
  end
end

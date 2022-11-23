require "application_system_test_case"

class JudgementsTest < ApplicationSystemTestCase
  setup do
    @judgement = judgements(:one)
  end

  test "visiting the index" do
    visit judgements_url
    assert_selector "h1", text: "Judgements"
  end

  test "creating a Judgement" do
    visit judgements_url
    click_on "New Judgement"

    fill_in "Query doc pair", with: @judgement.query_doc_pair_id
    fill_in "Rating", with: @judgement.rating
    fill_in "User", with: @judgement.user_id
    click_on "Create Judgement"

    assert_text "Judgement was successfully created"
    click_on "Back"
  end

  test "updating a Judgement" do
    visit judgements_url
    click_on "Edit", match: :first

    fill_in "Query doc pair", with: @judgement.query_doc_pair_id
    fill_in "Rating", with: @judgement.rating
    fill_in "User", with: @judgement.user_id
    click_on "Update Judgement"

    assert_text "Judgement was successfully updated"
    click_on "Back"
  end

  test "destroying a Judgement" do
    visit judgements_url
    page.accept_confirm do
      click_on "Destroy", match: :first
    end

    assert_text "Judgement was successfully destroyed"
  end
end

require "application_system_test_case"

class SelectionStrategiesTest < ApplicationSystemTestCase
  setup do
    @selection_strategy = selection_strategies(:one)
  end

  test "visiting the index" do
    visit selection_strategies_url
    assert_selector "h1", text: "Selection Strategies"
  end

  test "creating a Selection strategy" do
    visit selection_strategies_url
    click_on "New Selection Strategy"

    fill_in "Name", with: @selection_strategy.name
    click_on "Create Selection strategy"

    assert_text "Selection strategy was successfully created"
    click_on "Back"
  end

  test "updating a Selection strategy" do
    visit selection_strategies_url
    click_on "Edit", match: :first

    fill_in "Name", with: @selection_strategy.name
    click_on "Update Selection strategy"

    assert_text "Selection strategy was successfully updated"
    click_on "Back"
  end

  test "destroying a Selection strategy" do
    visit selection_strategies_url
    page.accept_confirm do
      click_on "Destroy", match: :first
    end

    assert_text "Selection strategy was successfully destroyed"
  end
end

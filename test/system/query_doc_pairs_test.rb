require "application_system_test_case"

class QueryDocPairsTest < ApplicationSystemTestCase
  setup do
    @query_doc_pair = query_doc_pairs(:one)
  end

  test "visiting the index" do
    visit query_doc_pairs_url
    assert_selector "h1", text: "Query Doc Pairs"  # TODO this should be starts with, not equals
  end

  test "creating a Query doc pair" do
    visit query_doc_pairs_url
    click_on "New Query Doc Pair"

    fill_in "Book", with: @query_doc_pair.book_id
    fill_in "Document fields", with: @query_doc_pair.document_fields
    fill_in "Query text", with: @query_doc_pair.query_text
    fill_in "Rank", with: @query_doc_pair.rank
    fill_in "User", with: @query_doc_pair.user_id
    fill_in "Doc ID", with: @query_doc_pair.doc_id
    click_on "Create Query doc pair"

    assert_text "Query doc pair was successfully created"
    click_on "Back"
  end

  test "updating a Query doc pair" do
    visit query_doc_pairs_url
    click_on "Edit", match: :first

    fill_in "Book", with: @query_doc_pair.book_id
    fill_in "Document fields", with: @query_doc_pair.document_fields
    fill_in "Query text", with: @query_doc_pair.query_text
    fill_in "Rank", with: @query_doc_pair.rank
    fill_in "User", with: @query_doc_pair.user_id
    fill_in "Doc ID", with: @query_doc_pair.doc_id
    click_on "Update Query doc pair"

    assert_text "Query doc pair was successfully updated"
    click_on "Back"
  end

  test "destroying a Query doc pair" do
    visit query_doc_pairs_url
    page.accept_confirm do
      click_on "Destroy", match: :first
    end

    assert_text "Query doc pair was successfully destroyed"
  end
end

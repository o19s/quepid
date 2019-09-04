require 'test_helper'

class RatingDocumentsFlowTest < ActionDispatch::IntegrationTest

  test "can rate documents that have various formatted document ids" do

    # asserts the route for normal doc id's works.
    assert_routing(
      { method: 'put', path: "/api/cases/44/queries/62/ratings/99" },
      { controller: "api/v1/queries/ratings", action: "update", format: :json, case_id: "44", "query_id": "62", doc_id: "99" }
    )

    # make sure using other non numeric identifiers works.
    assert_routing(
      { method: 'put', path: "/api/cases/44/queries/62/ratings/mydoc" },
      { controller: "api/v1/queries/ratings", action: "update", format: :json, case_id: "44", "query_id": "62", doc_id: "mydoc" }
    )

    # a period in the URL should work as well, and not be truncated.
    assert_routing(
      { method: 'put', path: "/api/cases/44/queries/62/ratings/mydoc.pdf" },
      { controller: "api/v1/queries/ratings", action: "update", format: :json, case_id: "44", "query_id": "62", doc_id: "mydoc.pdf" }
    )
  end
end

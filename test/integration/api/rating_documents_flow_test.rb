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

    # A period in the doc_id should work, however Rails assumes that post the dot is the format type.   We deal with this by
    # Base64 encoding in the Angular front end and decoding in ratings controller.
    assert_routing(
      { method: 'put', path: "/api/cases/44/queries/62/ratings/mydoc.pdf" },
      { controller: "api/v1/queries/ratings", action: "update", "format": "pdf", case_id: "44", "query_id": "62", doc_id: "mydoc" }
    )
  end
end

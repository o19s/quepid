require "test_helper"

class ProxyControllerTest < ActionDispatch::IntegrationTest
  test "should get get" do
    get proxy_fetch_path
    assert_response :success
  end
end

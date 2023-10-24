# frozen_string_literal: true

require 'test_helper'

# rubocop:disable Layout/LineLength
class ProxyControllerTest < ActionDispatch::IntegrationTest
  test 'should require a url query parameter' do
    assert_raises(ActionController::ParameterMissing) do
      get proxy_fetch_path
    end
    assert_raises(ActionController::ParameterMissing) do
      post proxy_fetch_path
    end
  end

  test 'should be able to handle a get' do
    
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select', fl: 'id,text', q:'legal', rows: 10, start: 0
    }
    assert_response :success
  end  
  
  test 'should be able to handle a get with a trailing ?q=legal parameter' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=legal', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  
  end
  
  test 'should be able to handle a post' do
    json_data = { query: 'trek', key2: 'value2' }.to_json

    post '/proxy/fetch?url=http://solr.quepid.com:8983/solr/statedecoded/select', params:  json_data,
                                                                                  headers: { 'Content-Type' => 'application/json' }
    assert_response :success
  end
end
# rubocop:enable Layout/LineLength

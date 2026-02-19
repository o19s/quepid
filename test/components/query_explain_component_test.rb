# frozen_string_literal: true

require 'test_helper'

class QueryExplainComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal_with_deferred_message
    render_inline(QueryExplainComponent.new(query_id: 42))
    assert_selector ".query-explain-wrapper[data-controller='query-explain']"
    assert_selector "button[data-action='click->query-explain#open']", text: 'Explain Query'
    assert_selector '#queryExplainModal-42.modal'
    assert_selector '.modal-title', text: 'Explain Query Parsing'
    assert_selector 'button.nav-link', text: 'Params'
    assert_selector 'button.nav-link', text: 'Parsing'
    assert_selector 'button.nav-link', text: 'Query Template'
    assert_selector '.tab-pane', text: /Query parameters are not returned/
    assert_selector '.tab-pane', text: /Run a search to see parsing/
    assert_selector '.tab-pane', text: /not a templated query/
  end

  def test_renders_params_and_parsing_when_provided
    render_inline(QueryExplainComponent.new(
                    query_id:     1,
                    params_json:  '{"q":"ruby","rows":10}',
                    parsing_json: '{"parsed":"query"}'
                  ))
    assert_selector 'pre', text: /"q": "ruby"/
    assert_selector 'pre', text: /"parsed": "query"/
    assert_selector 'button', text: 'Copy Params'
    assert_selector 'button', text: 'Copy Parsing'
  end

  def test_uses_custom_params_message
    render_inline(QueryExplainComponent.new(
                    query_id:       2,
                    params_message: 'The list of query parameters was not returned by Solr.'
                  ))
    assert_selector '.tab-pane', text: /The list of query parameters was not returned by Solr/
  end

  def test_sanitizes_query_id_for_modal_id
    render_inline(QueryExplainComponent.new(query_id: 'http://example.com/1'))
    assert_selector '#queryExplainModal-http---example-com-1.modal'
  end
end

# frozen_string_literal: true

require 'test_helper'

module DatasetIndex
  class SearchSetupTest < ActiveSupport::TestCase
    let(:user) { users(:random) }
    let(:kase) { Case.create!(case_name: 'Haystack', owner: user) }

    def endpoint engine, url, mapper: nil
      SearchEndpoint.create!(owner: user, name: "My #{engine}", search_engine: engine, mapper_based_search_engine_id: mapper, api_method: 'POST', endpoint_url: url)
    end

    test 'keeps the Quepid placeholder in every starter query' do
      SearchSetup::STARTERS.each do |engine, starter|
        assert_includes starter[:query_params], '#$query##', engine
      end
    end

    test 'the Elasticsearch starter is a valid query body over the canonical fields' do
      body = JSON.parse(SearchSetup::STARTERS.fetch('es')[:query_params])

      assert_equal '#$query##', body.dig('query', 'multi_match', 'query')
      assert_equal %w[title^3 brand^2 description category], body.dig('query', 'multi_match', 'fields')
    end

    test 'gives an Elasticsearch case a new try with the endpoint and the starter query, and keeps the old try' do
      old = kase.tries.first
      old.update!(query_params: 'q=#$query##&old=1', field_spec: 'id:id, title:old')
      es = endpoint(:es, 'http://es.example.com:9200/shop/_search')

      new_try = SearchSetup.new(kase, es).apply

      kase.reload

      assert_equal [ new_try, old ], kase.tries.to_a
      assert_equal 2, new_try.try_number
      assert_equal 2, kase.last_try_number
      assert_equal old, new_try.parent
      assert_equal es, new_try.search_endpoint
      assert_equal SearchSetup::STARTERS.fetch('es')[:query_params], new_try.query_params
      assert_equal 'id:_id, title:title, thumb:thumb, brand, category', new_try.field_spec
      assert_equal 'Elasticsearch starter query', new_try.name
      assert_equal [ 'q=#$query##&old=1', 'id:id, title:old', nil ], [ old.reload.query_params, old.field_spec, old.search_endpoint ]
    end

    test 'takes the number of rows and escaping from the try it follows' do
      kase.tries.first.update!(number_of_rows: 25, escape_query: false)
      new_try = SearchSetup.new(kase, endpoint(:es, 'http://es.example.com/shop/_search')).apply

      assert_equal [ 25, false ], [ new_try.number_of_rows, new_try.escape_query ]
    end

    test 'OpenSearch gets the same query, and Solr one in its own language, each as the next try' do
      os = SearchSetup.new(kase, endpoint(:os, 'http://os.example.com/shop/_search')).apply
      solr = SearchSetup.new(kase, endpoint(:solr, 'http://solr.example.com/solr/shop/select')).apply

      assert_equal SearchSetup::STARTERS.fetch('es')[:query_params], os.query_params
      assert_equal 'q=#$query##&defType=edismax&qf=title^3 brand^2 description category', solr.query_params
      assert_equal 'id:id, title:title, thumb:thumb, brand, category', solr.field_spec
      assert_equal [ 2, 3 ], [ os.try_number, solr.try_number ]
      assert_equal os, solr.parent
    end

    test 'does nothing for an engine whose query language it does not know' do
      vespa = endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
      kase # made before counting

      assert_no_difference 'Try.count' do
        assert_nil SearchSetup.new(kase, vespa).apply
      end
      assert_equal 1, kase.reload.last_try_number
    end

    test 'starts a new chain of ancestors when the old one is too long to keep' do
      es = endpoint(:es, 'http://es.example.com/shop/_search')
      calls = 0
      kase.define_singleton_method(:save!) do |*args, **options|
        calls += 1
        raise ActiveRecord::ValueTooLong, 'too long' if 1 == calls

        super(*args, **options)
      end

      new_try = SearchSetup.new(kase, es).apply

      assert_equal 2, calls
      assert_nil new_try.parent
      assert_equal es, new_try.search_endpoint
    end
  end
end

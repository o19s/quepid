# frozen_string_literal: true

require 'test_helper'

class LlmJudgeAdaptersTest < ActiveSupport::TestCase
  let(:judge) { users(:judge_judy) }
  let(:query_doc_pair) { query_doc_pairs(:starwars_qdp1) }
  let(:judgement) { Judgement.new(query_doc_pair: query_doc_pair, user: judge) }
  let(:openai) { LlmJudgeAdapters.for('a-key', { llm_model: 'gpt-4o' }) }

  def openai_body content
    { 'choices' => [ { 'message' => { 'content' => content } } ] }
  end

  describe 'choosing an adapter' do
    test 'a judge with no provider at all is OpenAI shaped, as it always was' do
      assert_instance_of LlmJudgeAdapters::OpenAi, LlmJudgeAdapters.for('a-key', {})
    end

    test 'the registry decides which dialect a provider speaks' do
      assert_instance_of LlmJudgeAdapters::Anthropic,
                         LlmJudgeAdapters.for('a-key', { llm_provider: 'anthropic' })
      assert_instance_of LlmJudgeAdapters::Anthropic,
                         LlmJudgeAdapters.for('a-key', { llm_provider: 'azure_ai_foundry_anthropic' })
      assert_instance_of LlmJudgeAdapters::OpenAi,
                         LlmJudgeAdapters.for('a-key', { llm_provider: 'google_gemini' })
    end

    test 'an unknown provider name falls back to the OpenAI dialect rather than blowing up' do
      assert_instance_of LlmJudgeAdapters::OpenAi, LlmJudgeAdapters.for('a-key', { llm_provider: 'made_up' })
    end

    test 'TypeSafe Jev speaks its own dialect' do
      assert_instance_of LlmJudgeAdapters::Jev, LlmJudgeAdapters.for('a-key', { llm_provider: 'typesafe_jev' })
    end
  end

  describe 'the OpenAI envelope' do
    test 'is the chat completions request LlmService has always sent' do
      envelope = openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.')

      assert_equal 'v1/chat/completions', envelope[:path]
      assert_equal({ 'Authorization' => 'Bearer a-key' }, envelope[:headers])

      body = envelope[:body]

      assert_in_delta(0.7, body[:temperature])
      assert_equal 'gpt-4o', body[:model]
      assert_equal({ type: 'json_object' }, body[:response_format])
      assert_equal 'Judge it.', body[:messages][0][:content]
      assert_equal 'system', body[:messages][0][:role]
      assert_equal 'user', body[:messages][1][:role]
      assert_equal 'text', body[:messages][1][:content][0][:type]
      assert_equal 'image_url', body[:messages][1][:content][1][:type]
    end

    test 'carries the book scale into the system prompt' do
      envelope = openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.',
                                                         scale:         JudgeScale.for(books(:james_bond_movies)))

      assert_match(/rating scale is: 0 \(labeled "Not Relevant"\), 1 \(labeled "Relevant"\)/,
                   envelope[:body][:messages][0][:content])
    end

    test 'azure deployments and foundry get their own paths and api-key auth' do
      azure = LlmJudgeAdapters.for('k', {
        llm_provider:    'azure_openai',
        llm_model:       'gpt-4o-mini',
        llm_api_version: '2024-10-21',
      })
      foundry = LlmJudgeAdapters.for('k', { llm_provider: 'azure_ai_foundry' })

      assert_equal 'openai/deployments/gpt-4o-mini/chat/completions?api-version=2024-10-21', azure.path
      assert_equal 'models/chat/completions?api-version=2025-01-01-preview', foundry.path
      assert_equal({ 'api-key' => 'k' }, azure.headers)
    end

    test 'a judge with no key sends no auth header' do
      assert_empty LlmJudgeAdapters.for('', {}).headers
    end
  end

  describe 'the Anthropic envelope' do
    let(:anthropic) do
      LlmJudgeAdapters.for('a-key', { llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-5-20250514' })
    end

    test 'is a Messages API request with the system prompt lifted out of the messages' do
      envelope = anthropic.request_envelope(query_doc_pair, system_prompt: 'Judge it.')

      assert_equal 'v1/messages', envelope[:path]
      assert_equal 'a-key', envelope[:headers]['x-api-key']
      assert_equal '2023-06-01', envelope[:headers]['anthropic-version']
      assert_equal 'Judge it.', envelope[:body][:system]
      assert_equal 'image', envelope[:body][:messages][0][:content][1][:type]
    end

    test 'reads a judgement out of markdown fenced JSON' do
      body = { 'content' => [ { 'text' => "```json\n{\"judgment\": 2, \"explanation\": \"ok\"}\n```" } ] }

      anthropic.apply_response(judgement, body)

      assert_in_delta(2.0, judgement.rating)
      assert_equal 'ok', judgement.explanation
    end
  end

  describe 'attaching a document image' do
    def pair_with fields
      QueryDocPair.new(query_text: 'Han', doc_id: 'han', document_fields: fields)
    end

    def image_parts fields
      openai.user_prompt(pair_with(fields)).select { |part| 'image_url' == part[:type] }
    end

    def image_urls parts
      parts.map { |part| part.dig(:image_url, :url) }
    end

    test 'a case thumb is attached when there is no image' do
      parts = image_parts('title' => 'Han', 'thumb' => 'https://example.com/thumb.jpg')

      assert_equal [ { type: 'image_url', image_url: { url: 'https://example.com/thumb.jpg' } } ], parts
    end

    test 'an image wins over a thumb' do
      parts = image_parts('image' => 'https://example.com/image.png', 'thumb' => 'https://example.com/thumb.jpg')

      assert_equal [ 'https://example.com/image.png' ], image_urls(parts)
    end

    test 'a thumb stands in for an image that is not a usable URL' do
      parts = image_parts('image' => '/relative/image.png', 'thumb' => 'https://example.com/thumb.jpg')

      assert_equal [ 'https://example.com/thumb.jpg' ], image_urls(parts)
    end

    test 'a relative path is not attached, since the provider could not fetch it' do
      assert_empty image_parts('thumb' => '/t/p/w500/abc.jpg')
      assert_empty image_parts('image' => '  ')
      assert_empty image_parts('title' => 'Han')
    end

    test 'a judge switched to text only attaches no image' do
      text_only = LlmJudgeAdapters.for('a-key', { llm_model: 'gpt-4o', llm_include_images: 'false' })
      prompt = text_only.user_prompt(pair_with('image' => 'https://example.com/image.png',
                                               'thumb' => 'https://example.com/thumb.jpg'))

      assert_equal [ 'text' ], prompt.pluck(:type)
    end

    test 'a judge saved before the switch existed still sends images' do
      [ nil, '', 'true', true ].each do |setting|
        adapter = LlmJudgeAdapters.for('a-key', { llm_model: 'gpt-4o', llm_include_images: setting })
        prompt = adapter.user_prompt(pair_with('thumb' => 'https://example.com/thumb.jpg'))

        assert_equal %w[text image_url], prompt.pluck(:type), "llm_include_images: #{setting.inspect}"
      end
    end

    test 'a provider that cannot take an image URL never gets one, whatever the judge says' do
      [ nil, 'true' ].each do |setting|
        ollama = LlmJudgeAdapters.for('', { llm_provider: 'ollama', llm_model: 'qwen3:0.6b',
                                            llm_include_images: setting })
        prompt = ollama.user_prompt(pair_with('thumb' => 'https://example.com/thumb.jpg'))

        assert_equal [ 'text' ], prompt.pluck(:type), "llm_include_images: #{setting.inspect}"
      end
    end

    test 'Anthropic gets a case thumb as a URL image source' do
      anthropic = LlmJudgeAdapters.for('a-key', { llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-5-20250514' })
      pair = pair_with('title' => 'Han', 'thumb' => 'https://example.com/thumb.jpg')

      content = anthropic.request_envelope(pair, system_prompt: 'Judge it.')[:body][:messages][0][:content]

      assert_equal({ type: 'image', source: { type: 'url', url: 'https://example.com/thumb.jpg' } }, content[1])
    end
  end

  # The properties that let a request built now be sent later by something else
  # -- the batch API this seam is shaped for. See ADR 0001 §3.
  describe 'the batch readiness contract' do
    test 'B1: building a request performs no I/O' do
      # WebMock is on with net connect disabled: any HTTP here would raise.
      envelope = openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.')

      assert_equal envelope, openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.')
    end

    test 'B2: the envelope survives a round trip through JSON' do
      envelope = openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.')

      assert_equal envelope.deep_stringify_keys, JSON.parse(envelope.to_json)
    end

    test 'B3: applying a response takes a plain hash, not a live HTTP response' do
      openai.apply_response(judgement, openai_body('{"judgment": 3, "explanation": "spot on"}'))

      assert_in_delta(3.0, judgement.rating)
      assert_equal 'spot on', judgement.explanation
    end

    test 'B4: applying a response does not save the judgement' do
      openai.apply_response(judgement, openai_body('{"judgment": 1, "explanation": "meh"}'))

      assert_predicate judgement, :new_record?
    end

    test 'a request built, stored as a JSONL line and answered later still lands' do
      envelope = openai.request_envelope(query_doc_pair, system_prompt: 'Judge it.')

      # Round-trips the envelope through what a batch writer would persist to a
      # JSONL file and what a separate process would read back from it hours later.
      line = {
        custom_id: "qdp-#{query_doc_pair.id}",
        method:    'POST',
        url:       "/#{envelope[:path]}",
        body:      envelope[:body],
      }.to_json

      replayed = JSON.parse(line)
      response = { 'status_code' => 200,
                   'body'        => openai_body('{"judgment": 2, "explanation": "from a batch"}') }
      output = { 'custom_id' => "qdp-#{query_doc_pair.id}", 'response' => response }

      assert_equal 'POST', replayed['method']
      assert_equal '/v1/chat/completions', replayed['url']

      LlmJudgeAdapters.for('a-key', {})
        .apply_response(judgement, output.dig('response', 'body'))

      assert_in_delta(2.0, judgement.rating)
      assert_equal 'from a batch', judgement.explanation
    end
  end

  describe 'reading a rating that is not a number' do
    test 'a non-numeric judgment becomes nil rather than a coerced 0.0' do
      openai.apply_response(judgement, openai_body('{"judgment": "N/A", "explanation": "no idea"}'))

      assert_nil judgement.rating
    end

    test 'a numeric-looking string is still accepted' do
      openai.apply_response(judgement, openai_body('{"judgment": "2", "explanation": "fine"}'))

      assert_in_delta(2.0, judgement.rating)
    end
  end
end

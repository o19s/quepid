class ReshapeJudgeOptionsUrlsForRubyLlm < ActiveRecord::Migration[8.0]
  AZURE_FOUNDRY_DEFAULT_API_VERSION = '2025-01-01-preview'

  def up
    User.where.not(options: nil).find_each do |user|
      judge_options = user.options&.dig('judge_options')
      next unless judge_options.is_a?(Hash)

      provider = judge_options['llm_provider'].to_s
      url = judge_options['llm_service_url'].to_s.sub(%r{/+\z}, '')
      next if url.blank?

      api_version = judge_options['llm_api_version'].to_s

      new_url =
        case provider
        when 'azure_openai'
          url.include?('/openai/') ? url : "#{url}/openai/v1"
        when 'azure_ai_foundry'
          version = api_version.presence || AZURE_FOUNDRY_DEFAULT_API_VERSION
          url.include?('api-version=') ? url : "#{url}?api-version=#{version}"
        when 'azure_ai_foundry_serverless'
          url.end_with?('/v1/chat/completions') ? url : "#{url}/v1/chat/completions"
        else
          url
        end

      judge_options['llm_service_url'] = new_url
      judge_options.delete('llm_api_version')

      user.options = user.options.merge('judge_options' => judge_options)
      user.save!(validate: false)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, 'Cannot reliably reverse URL reshape for ruby_llm'
  end
end

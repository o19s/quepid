require 'ollama'
require 'json'

class LabelGenerator
  def initialize
    @client = Ollama::Client.new(base_url: 'http://host.docker.internal:11434')
  end

  def generate_labels(queries)
    prompt = <<~PROMPT
      Generate 3-5 potential category labels for these queries: #{queries}.
      Return only a JSON array of strings, like this: ["label1", "label2", "label3"]
      No other text, just the JSON array.
    PROMPT

    response = @client.generate(
      model: 'llama3.2',
      prompt: prompt,
      stream: false
    )

    # Clean the response and parse JSON
    clean_response = response.response.strip
    # Remove any markdown code block indicators if present
    clean_response = clean_response.gsub('```json', '').gsub('```', '')
    
    JSON.parse(clean_response)
  rescue JSON::ParserError => e
    # Fallback if JSON parsing fails
    puts "HAD AN ERROR"
    []
  end
end

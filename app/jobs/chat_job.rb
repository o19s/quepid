require 'net/http'

class ChatJob < ApplicationJob
  queue_as :default

  def perform(prompt)
    uri = URI("http://host.docker.internal:11434/api/generate")
    request = Net::HTTP::Post.new(uri, "Content-Type" => "application/json")
    request.body = {
      model: "llama3.2",
      prompt: context(prompt),
      temperature: 1,
      stream: true
    }.to_json

    Net::HTTP.start(uri.hostname, uri.port) do |http|
      rand = SecureRandom.hex(10)
      broadcast_message("messages", message_div(rand))
      http.request(request) do |response|
        response.read_body do |chunk|
          Rails.logger.info "✅ #{chunk}"
          puts "✅ #{chunk}"
          process_chunk(chunk, rand)
        end
      end
    end
  end

  private

  def context(prompt)
    "[INST]#{prompt}[/INST]"
  end

  def message_div(rand)
    <<~HTML
      <div id='#{rand}'
        data-controller='markdown-text'
        data-markdown-text-update-value=''
        class='bg-primary-subtle p-2 rounded-lg mb-2 rounded'></div>
    HTML
  end

  def broadcast_message(target, message)
    Turbo::StreamsChannel.broadcast_append_to "welcome", target: target, html: message
  end

  def process_chunk(chunk, rand)
    json = JSON.parse(chunk)
    done = json["done"]
    message = json["response"].to_s.strip.size.zero? ? "<br>" : json["response"]
    if done
      message = "<script>document.getElementById('#{rand}').dataset.markdownTextUpdatedValue = '#{Time.current.to_f}';</script>"
      broadcast_message(rand, message)
    else
      broadcast_message(rand, message)
    end
  end
end

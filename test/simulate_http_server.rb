# Fire it up with `ruby simulate_http_server.rb` to test
# various behaviors with Quepid. 

require 'socket'

server = TCPServer.new('localhost', 5000)
retry_after = 20

puts "Server started at http://localhost:5000/"
puts "Press Ctrl+C to stop"
puts "Initial Retry-After value: #{retry_after}"
puts "Will return 200 OK when Retry-After reaches 0"
puts "CORS headers enabled for ALL origins and ALL headers"

loop do
  client = server.accept
  request = ""
  headers = {}
  
  # Read the request headers
  while line = client.gets
    request += line if request.empty?
    line = line.strip
    break if line.empty?
    
    if line =~ /^([^:]+):\s*(.+)$/
      headers[$1] = $2
    end
  end
  
  method = request.split(' ').first rescue 'GET'
  puts "Received #{method} request: #{request.strip}"
  
  # CORS headers using wildcard for all headers
  cors_headers = 
    "Access-Control-Allow-Origin: *\r\n" +
    "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD\r\n" +
    "Access-Control-Allow-Headers: *\r\n" +
    "Access-Control-Allow-Credentials: true\r\n" +
    "Access-Control-Max-Age: 86400\r\n"
  
  if method == 'OPTIONS'
    # Handle preflight requests
    response = "HTTP/1.1 200 OK\r\n" +
              "Content-Type: text/plain\r\n" +
              cors_headers +
              "Content-Length: 0\r\n" +
              "Connection: close\r\n" +
              "\r\n"
    puts "Responding to OPTIONS request with 200 OK (CORS preflight)"
  else
    # Regular request handling with retry logic
    puts "Current Retry-After value: #{retry_after}"
    
    if retry_after > 0
      response = "HTTP/1.1 429 Too Many Requests\r\n" +                
                "Retry-After: #{retry_after}\r\n" +
                "Content-Type: text/plain\r\n" +
                cors_headers +
                "Connection: close\r\n" +
                "\r\n" +
                "Too Many Requests"
      puts "Responding with 429 Too Many Requests"
      
      # Decrease retry_after by 5, but don't go below 0
      retry_after = [retry_after - 5, 0].max
    else
      response = "HTTP/1.1 200 OK\r\n" +
                "Content-Type: text/plain\r\n" +
                cors_headers +
                "Connection: close\r\n" +
                "\r\n" +
                "Request accepted!"
      puts "Responding with 200 OK"
    end
  end
          
  client.puts(response)
  client.close
end

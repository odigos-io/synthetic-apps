# frozen_string_literal: true

# Stdlib only, so the same source runs on every Ruby version this app is built for (2.7 - 3.4).
# webrick is not used because it was removed from the standard library in Ruby 3.0.
require 'socket'
require 'net/http'
require 'uri'
require 'json'
require 'logger'
require 'time'

$stdout.sync = true

PORT = Integer(ENV.fetch('PORT', '8080'))
REQUEST_INTERVAL_SEC = Integer(ENV.fetch('REQUEST_INTERVAL_SEC', '10'))

# Target for the outbound request loop. Defaults to this process so the app is self-contained,
# while the manifests point it at the deployment's own Service, so the traffic leaves the pod
# and is visible to network level instrumentation as well as to in-process instrumentation.
TARGET_URL = ENV.fetch('TARGET_URL', "http://localhost:#{PORT}/static/success")

LOGGER = Logger.new($stdout)
LOGGER.formatter = proc do |severity, datetime, _progname, msg|
  "[#{datetime.utc.iso8601}] #{severity.ljust(5)} -- #{msg}\n"
end

def read_request_path(conn)
  request_line = conn.gets
  return nil if request_line.nil?

  # Headers are not used, but must be drained before responding.
  while (line = conn.gets)
    break if line == "\r\n" || line == "\n"
  end

  request_line.split(' ')[1]
end

def respond(conn, status, body, content_type)
  conn.print "HTTP/1.1 #{status}\r\n"
  conn.print "Content-Type: #{content_type}\r\n"
  conn.print "Content-Length: #{body.bytesize}\r\n"
  conn.print "Connection: close\r\n"
  conn.print "\r\n"
  conn.print body
end

def handle(conn)
  path = read_request_path(conn)
  return if path.nil?

  case path
  when '/static/success'
    LOGGER.info('got request for /static/success, replying hello-world')
    respond(conn, '200 OK', 'Hello, World!', 'text/plain')
  when '/health'
    body = JSON.generate('status' => 'healthy', 'timestamp' => Time.now.utc.iso8601)
    respond(conn, '200 OK', body, 'application/json')
  when '/'
    body = JSON.generate('message' => 'Ruby HTTP Server is running', 'rubyVersion' => RUBY_VERSION)
    respond(conn, '200 OK', body, 'application/json')
  else
    respond(conn, '404 Not Found', 'not found', 'text/plain')
  end
end

def start_request_loop
  Thread.new do
    loop do
      sleep(REQUEST_INTERVAL_SEC)
      begin
        LOGGER.info("Executing GET: #{TARGET_URL}")
        response = Net::HTTP.get_response(URI.parse(TARGET_URL))
        LOGGER.info("HTTP request completed | URL: #{TARGET_URL} | Status: #{response.code}")
      rescue StandardError => e
        LOGGER.error("HTTP request failed | URL: #{TARGET_URL} | Exception: #{e.class} - #{e.message}")
      end
    end
  end
end

Signal.trap('TERM') { exit 0 }

server = TCPServer.new('0.0.0.0', PORT)
LOGGER.info("Ruby HTTP Server (Ruby #{RUBY_VERSION}) listening on http://0.0.0.0:#{PORT}/")
LOGGER.info("Outbound requests to #{TARGET_URL} every #{REQUEST_INTERVAL_SEC} seconds")

start_request_loop

loop do
  conn = server.accept
  Thread.new(conn) do |client|
    begin
      handle(client)
    rescue StandardError => e
      LOGGER.error("Failed to handle connection | Exception: #{e.class} - #{e.message}")
    ensure
      client.close
    end
  end
end

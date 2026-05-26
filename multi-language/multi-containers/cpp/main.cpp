#include <arpa/inet.h>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <netinet/in.h>
#include <string>
#include <sys/socket.h>
#include <unistd.h>

namespace {

int portFromEnv() {
  const char *env = std::getenv("PORT");
  if (env == nullptr || std::strlen(env) == 0) {
    return 8050;
  }
  return std::atoi(env);
}

bool startsWith(const std::string &value, const std::string &prefix) {
  return value.size() >= prefix.size() &&
         value.compare(0, prefix.size(), prefix) == 0;
}

}  // namespace

int main() {
  const int port = portFromEnv();
  const std::string body = R"({"status":"healthy","language":"cpp"})";
  const std::string response =
      "HTTP/1.1 200 OK\r\n"
      "Content-Type: application/json\r\n"
      "Connection: close\r\n"
      "Content-Length: " +
      std::to_string(body.size()) + "\r\n\r\n" + body;

  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    std::cerr << "socket failed\n";
    return 1;
  }

  int opt = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

  sockaddr_in address{};
  address.sin_family = AF_INET;
  address.sin_addr.s_addr = INADDR_ANY;
  address.sin_port = htons(static_cast<uint16_t>(port));

  if (bind(server_fd, reinterpret_cast<sockaddr *>(&address), sizeof(address)) <
      0) {
    std::cerr << "bind failed\n";
    return 1;
  }

  if (listen(server_fd, 16) < 0) {
    std::cerr << "listen failed\n";
    return 1;
  }

  std::cout << "multi-containers cpp listening on port " << port << std::endl;

  while (true) {
    sockaddr_in client_addr{};
    socklen_t client_len = sizeof(client_addr);
    int client_fd =
        accept(server_fd, reinterpret_cast<sockaddr *>(&client_addr), &client_len);
    if (client_fd < 0) {
      continue;
    }

    char buffer[1024];
    ssize_t bytes_read = read(client_fd, buffer, sizeof(buffer) - 1);
    if (bytes_read > 0) {
      buffer[bytes_read] = '\0';
      std::string request(buffer);
      if (startsWith(request, "GET /healthz")) {
        send(client_fd, response.c_str(), response.size(), 0);
      } else {
        const char *not_found =
            "HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n";
        send(client_fd, not_found, std::strlen(not_found), 0);
      }
    }

    close(client_fd);
  }
}

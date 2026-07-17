var http = require('http');

var PORT = 8080;

var server = http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(PORT, function () {
  console.log('rollout server listening on port ' + PORT);
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

var http = require('http');
var url = require('url');

var PORT = 8080;
var FAIL_READY_WHEN_INSTRUMENTED =
  process.env.FAIL_READY_WHEN_INSTRUMENTED === 'true' ||
  process.env.FAIL_READY_WHEN_INSTRUMENTED === '1';

function isReady() {
  if (FAIL_READY_WHEN_INSTRUMENTED && process.env.ODIGOS_POD_NAME) {
    return false;
  }
  return true;
}

var server = http.createServer(function (req, res) {
  var pathname = url.parse(req.url).pathname;

  if (pathname === '/ready') {
    if (!isReady()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ready: false,
          reason: 'FAIL_READY_WHEN_INSTRUMENTED is set and ODIGOS_POD_NAME is present'
        })
      );
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(PORT, function () {
  console.log('rollout server listening on port ' + PORT);
  if (FAIL_READY_WHEN_INSTRUMENTED) {
    console.log('FAIL_READY_WHEN_INSTRUMENTED enabled; /ready fails when ODIGOS_POD_NAME is set');
  }
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

var http = require('http');
var url = require('url');

var PORT = 8080;

function readBody(req, callback) {
  var chunks = [];
  req.on('data', function (chunk) {
    chunks.push(chunk);
  });
  req.on('end', function () {
    callback(Buffer.concat(chunks).toString());
  });
  req.on('error', function (err) {
    callback('', err);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

var server = http.createServer(function (req, res) {
  var pathname = url.parse(req.url).pathname;

  if (pathname === '/healthz') {
    sendJson(res, 200, { status: 'healthy' });
    return;
  }

  if (pathname === '/echo' || pathname.indexOf('/echo/') === 0) {
    readBody(req, function (body, err) {
      if (err) {
        sendJson(res, 400, { error: 'failed to read request body' });
        return;
      }

      var contentType = req.headers['content-type'] || '';
      if (contentType.indexOf('application/json') !== -1) {
        if (!body) {
          sendJson(res, 200, {});
          return;
        }
        try {
          sendJson(res, 200, JSON.parse(body));
        } catch (parseErr) {
          sendJson(res, 400, { error: 'invalid json body' });
        }
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType || 'text/plain'
      });
      res.end(body);
    });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, function () {
  console.log('pii-masking server listening on port ' + PORT);
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

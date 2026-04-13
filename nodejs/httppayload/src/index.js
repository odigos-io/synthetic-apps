var express = require('express');
var http = require('http');
var multer = require('multer');

var app = express();
var upload = multer();

var PORT = 8080;
var SELF_HOST = process.env.SELF_HOST || 'localhost';

// ─── Middleware for parsing different content types ───

app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/plain' }));
app.use(express.text({ type: 'text/html' }));
app.use(express.text({ type: 'text/xml' }));
app.use(express.text({ type: 'application/xml' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));

// ─── Helper: make an outgoing POST request to self ───

function postToSelf(path, contentType, body) {
  return new Promise(function (resolve, reject) {
    var payload = typeof body === 'object' && !Buffer.isBuffer(body)
      ? JSON.stringify(body)
      : body;

    var options = {
      hostname: SELF_HOST,
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    var req = http.request(options, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buf.toString(),
          rawBody: buf,
        });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Health check ───

app.get('/health', function (req, res) {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════
// Echo endpoints — receive payload and return it as-is.
// These are the targets for the outgoing self-requests.
// ═══════════════════════════════════════════════════════

app.post('/echo/json', function (req, res) {
  console.log('echo/json: received payload');
  res.set('Content-Type', 'application/json');
  res.json(req.body);
});

app.post('/echo/text', function (req, res) {
  console.log('echo/text: received payload');
  res.set('Content-Type', 'text/plain');
  res.send(req.body);
});

app.post('/echo/html', function (req, res) {
  console.log('echo/html: received payload');
  res.set('Content-Type', 'text/html');
  res.send(req.body);
});

app.post('/echo/xml', function (req, res) {
  console.log('echo/xml: received payload');
  res.set('Content-Type', 'application/xml');
  res.send(req.body);
});

app.post('/echo/form', function (req, res) {
  console.log('echo/form: received payload');
  res.set('Content-Type', 'application/json');
  res.json(req.body);
});

app.post('/echo/multipart', upload.fields([
  { name: 'username', maxCount: 1 },
  { name: 'email', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]), function (req, res) {
  console.log('echo/multipart: received payload');
  res.set('Content-Type', 'application/json');
  var result = { fields: req.body };
  if (req.files && req.files.file) {
    result.file = {
      originalname: req.files.file[0].originalname,
      mimetype: req.files.file[0].mimetype,
      size: req.files.file[0].size,
    };
  }
  res.json(result);
});

app.post('/echo/binary', function (req, res) {
  console.log('echo/binary: received payload');
  res.set('Content-Type', 'application/octet-stream');
  res.send(req.body);
});

// ═══════════════════════════════════════════════════════
// Payload endpoints — receive a POST, make an outgoing
// request to the matching /echo/* endpoint on self,
// then return both the original and echoed data.
// ═══════════════════════════════════════════════════════

// POST application/json
app.post('/payload/json', function (req, res) {
  console.log('payload/json: received request, making outgoing call');
  postToSelf('/echo/json', 'application/json', req.body)
    .then(function (echoRes) {
      res.json({
        incoming: req.body,
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          body: JSON.parse(echoRes.body),
        },
      });
    })
    .catch(function (err) {
      console.error('payload/json outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST text/plain
app.post('/payload/text', function (req, res) {
  console.log('payload/text: received request, making outgoing call');
  postToSelf('/echo/text', 'text/plain', req.body)
    .then(function (echoRes) {
      res.json({
        incoming: req.body,
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          body: echoRes.body,
        },
      });
    })
    .catch(function (err) {
      console.error('payload/text outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST text/html
app.post('/payload/html', function (req, res) {
  console.log('payload/html: received request, making outgoing call');
  postToSelf('/echo/html', 'text/html', req.body)
    .then(function (echoRes) {
      res.json({
        incoming: req.body,
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          body: echoRes.body,
        },
      });
    })
    .catch(function (err) {
      console.error('payload/html outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST application/xml
app.post('/payload/xml', function (req, res) {
  console.log('payload/xml: received request, making outgoing call');
  postToSelf('/echo/xml', 'application/xml', req.body)
    .then(function (echoRes) {
      res.json({
        incoming: req.body,
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          body: echoRes.body,
        },
      });
    })
    .catch(function (err) {
      console.error('payload/xml outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST application/x-www-form-urlencoded
app.post('/payload/form', function (req, res) {
  console.log('payload/form: received request, making outgoing call');
  var querystring = require('querystring');
  var encoded = querystring.stringify(req.body);
  postToSelf('/echo/form', 'application/x-www-form-urlencoded', encoded)
    .then(function (echoRes) {
      res.json({
        incoming: req.body,
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          body: JSON.parse(echoRes.body),
        },
      });
    })
    .catch(function (err) {
      console.error('payload/form outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// POST multipart/form-data
app.post('/payload/multipart', upload.fields([
  { name: 'username', maxCount: 1 },
  { name: 'email', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]), function (req, res) {
  console.log('payload/multipart: received request, making outgoing call');

  var boundary = '----SyntheticBoundary' + Date.now();
  var parts = [];

  Object.keys(req.body).forEach(function (key) {
    parts.push(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="' + key + '"\r\n\r\n' +
      req.body[key] + '\r\n'
    );
  });

  if (req.files && req.files.file) {
    var f = req.files.file[0];
    parts.push(
      '--' + boundary + '\r\n' +
      'Content-Disposition: form-data; name="file"; filename="' + f.originalname + '"\r\n' +
      'Content-Type: ' + f.mimetype + '\r\n\r\n' +
      f.buffer.toString() + '\r\n'
    );
  }

  parts.push('--' + boundary + '--\r\n');
  var multipartBody = parts.join('');

  var options = {
    hostname: SELF_HOST,
    port: PORT,
    path: '/echo/multipart',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': Buffer.byteLength(multipartBody),
    },
  };

  var outReq = http.request(options, function (outRes) {
    var chunks = [];
    outRes.on('data', function (chunk) { chunks.push(chunk); });
    outRes.on('end', function () {
      var incomingResult = { fields: req.body };
      if (req.files && req.files.file) {
        incomingResult.file = {
          originalname: req.files.file[0].originalname,
          mimetype: req.files.file[0].mimetype,
          size: req.files.file[0].size,
        };
      }
      res.json({
        incoming: incomingResult,
        outgoing: {
          statusCode: outRes.statusCode,
          contentType: outRes.headers['content-type'],
          body: JSON.parse(Buffer.concat(chunks).toString()),
        },
      });
    });
  });

  outReq.on('error', function (err) {
    console.error('payload/multipart outgoing error:', err.message);
    res.status(502).json({ error: err.message });
  });

  outReq.write(multipartBody);
  outReq.end();
});

// POST application/octet-stream
app.post('/payload/binary', function (req, res) {
  console.log('payload/binary: received request, making outgoing call');
  postToSelf('/echo/binary', 'application/octet-stream', req.body)
    .then(function (echoRes) {
      res.json({
        incoming: {
          size: req.body.length,
          hex: req.body.toString('hex'),
        },
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          size: echoRes.rawBody.length,
          hex: echoRes.rawBody.toString('hex'),
        },
      });
    })
    .catch(function (err) {
      console.error('payload/binary outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// ═══════════════════════════════════════════════════════
// Large JSON payload (~20KB)
// ═══════════════════════════════════════════════════════

function generateLargeJson() {
  var items = [];
  for (var i = 0; i < 120; i++) {
    items.push({
      id: i,
      uuid: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function () {
        return Math.floor(Math.random() * 16).toString(16);
      }),
      name: 'User ' + i,
      email: 'user' + i + '@example.com',
      active: i % 3 !== 0,
      score: Math.round(Math.random() * 10000) / 100,
      tags: ['tag-' + (i % 5), 'tag-' + (i % 7), 'tag-' + (i % 11)],
    });
  }
  return { metadata: { count: items.length, generatedAt: new Date().toISOString() }, items: items };
}

app.post('/echo/json-large', function (req, res) {
  console.log('echo/json-large: received payload (' + JSON.stringify(req.body).length + ' bytes)');
  res.set('Content-Type', 'application/json');
  res.json(req.body);
});

app.post('/payload/json-large', function (req, res) {
  console.log('payload/json-large: received request, making outgoing call');
  postToSelf('/echo/json-large', 'application/json', req.body)
    .then(function (echoRes) {
      var parsedEcho = JSON.parse(echoRes.body);
      res.json({
        incoming: {
          itemCount: req.body.items ? req.body.items.length : 0,
          sizeBytes: JSON.stringify(req.body).length,
        },
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          itemCount: parsedEcho.items ? parsedEcho.items.length : 0,
          sizeBytes: echoRes.body.length,
        },
      });
    })
    .catch(function (err) {
      console.error('payload/json-large outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// GET endpoint that generates the ~20KB payload itself and forwards it
app.get('/payload/json-large/generate', function (req, res) {
  console.log('payload/json-large/generate: generating ~20KB JSON and making outgoing call');
  var largeBody = generateLargeJson();
  postToSelf('/echo/json-large', 'application/json', largeBody)
    .then(function (echoRes) {
      var parsedEcho = JSON.parse(echoRes.body);
      res.json({
        incoming: {
          itemCount: largeBody.items.length,
          sizeBytes: JSON.stringify(largeBody).length,
        },
        outgoing: {
          statusCode: echoRes.statusCode,
          contentType: echoRes.headers['content-type'],
          itemCount: parsedEcho.items ? parsedEcho.items.length : 0,
          sizeBytes: echoRes.body.length,
        },
      });
    })
    .catch(function (err) {
      console.error('payload/json-large/generate outgoing error:', err.message);
      res.status(502).json({ error: err.message });
    });
});

// ─── Start server ───

var server = app.listen(PORT, function () {
  console.log('httppayload server running at http://127.0.0.1:' + PORT + '/');
  console.log('Available POST endpoints:');
  console.log('  /payload/json          (application/json)');
  console.log('  /payload/text          (text/plain)');
  console.log('  /payload/html          (text/html)');
  console.log('  /payload/xml           (application/xml)');
  console.log('  /payload/form          (application/x-www-form-urlencoded)');
  console.log('  /payload/multipart     (multipart/form-data)');
  console.log('  /payload/binary        (application/octet-stream)');
  console.log('  /payload/json-large    (application/json, ~20KB)');
  console.log('  /payload/json-large/generate  (GET, generates ~20KB JSON)');
});

process.on('SIGTERM', function () {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(function () {
    console.log('HTTP server closed');
    process.exit(0);
  });
  setTimeout(function () {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

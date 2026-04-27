var express = require('express');
var http = require('http');

var app = express();
var PORT = 8080;

var DURATIONS = {
  short: 50,
  medium: 750,
  long: 1500
};

function shouldReturnError(req) {
  return req.query.error === 'true' || req.query.error === '1';
}

function sendScenarioResponse(req, res, scenario) {
  var isError = shouldReturnError(req);
  var statusCode = isError ? 500 : 200;
  var delayMs = scenario.delayMs || 0;

  setTimeout(function () {
    res.status(statusCode).json({
      endpoint: scenario.endpoint,
      description: scenario.description,
      simulated_duration_ms: delayMs,
      forced_error: isError,
      status_code: statusCode
    });
  }, delayMs);
}

function parseHops(req) {
  var hops = parseInt(req.query.hops, 10);
  if (Number.isNaN(hops) || hops < 1) {
    return 1;
  }
  return hops;
}

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy' });
});

// Baseline route for the cost-reduction bucket.
app.get('/sampling/tail/no-rule', function (req, res) {
  sendScenarioResponse(req, res, {
    endpoint: '/sampling/tail/no-rule',
    description: 'baseline traffic sampled through the 10% cost-reduction rule'
  });
});

// Dedicated route for validating error-focused tail sampling. Use ?error=true to return 500.
app.get('/sampling/tail/error', function (req, res) {
  sendScenarioResponse(req, res, {
    endpoint: '/sampling/tail/error',
    description: 'tail-sampling error scenario; add ?error=true to force HTTP 500'
  });
});

app.get('/sampling/tail/duration/short', function (req, res) {
  sendScenarioResponse(req, res, {
    endpoint: '/sampling/tail/duration/short',
    description: 'short request duration, sampled through the 10% cost-reduction rule',
    delayMs: DURATIONS.short
  });
});

app.get('/sampling/tail/duration/medium', function (req, res) {
  sendScenarioResponse(req, res, {
    endpoint: '/sampling/tail/duration/medium',
    description: 'medium request duration above 500ms, sampled at 50%',
    delayMs: DURATIONS.medium
  });
});

app.get('/sampling/tail/duration/long', function (req, res) {
  sendScenarioResponse(req, res, {
    endpoint: '/sampling/tail/duration/long',
    description: 'long request duration above 1000ms, sampled at 100%',
    delayMs: DURATIONS.long
  });
});

app.get('/sampling/tail/hops', function (req, res) {
  var hops = parseHops(req);
  var isError = shouldReturnError(req);

  if (hops === 1) {
    return res.status(isError ? 500 : 200).json({
      endpoint: '/sampling/tail/hops',
      description: 'final hop returns success or error based on the error query parameter',
      hops_remaining: hops,
      forced_error: isError,
      status_code: isError ? 500 : 200
    });
  }

  var nextPath = '/sampling/tail/hops?hops=' + (hops - 1) + (isError ? '&error=true' : '');
  http.get({
    hostname: '127.0.0.1',
    port: PORT,
    path: nextPath
  }, function (selfRes) {
    var body = '';

    selfRes.setEncoding('utf8');
    selfRes.on('data', function (chunk) {
      body += chunk;
    });
    selfRes.on('end', function () {
      res.status(selfRes.statusCode).json({
        endpoint: '/sampling/tail/hops',
        description: 'hop made an outgoing HTTP request to itself',
        hops_remaining: hops,
        next_path: nextPath,
        downstream_status_code: selfRes.statusCode,
        downstream_body: body
      });
    });
  }).on('error', function (err) {
    res.status(502).json({
      endpoint: '/sampling/tail/hops',
      error: err.message
    });
  });
});

app.get('/sampling/tail/hops/non-propagating-error', function (req, res) {
  var hops = parseHops(req);
  var isError = shouldReturnError(req);
  var statusCode = hops === 1 && isError ? 500 : 200;

  if (hops === 1) {
    return res.status(statusCode).json({
      endpoint: '/sampling/tail/hops/non-propagating-error',
      description: 'final hop returns success or error based on the error query parameter',
      hops_remaining: hops,
      forced_error: isError,
      status_code: statusCode
    });
  }

  var nextPath = '/sampling/tail/hops/non-propagating-error?hops=' + (hops - 1) + (isError ? '&error=true' : '');
  http.get({
    hostname: '127.0.0.1',
    port: PORT,
    path: nextPath
  }, function (selfRes) {
    var body = '';

    selfRes.setEncoding('utf8');
    selfRes.on('data', function (chunk) {
      body += chunk;
    });
    selfRes.on('end', function () {
      res.status(statusCode).json({
        endpoint: '/sampling/tail/hops/non-propagating-error',
        description: 'hop made an outgoing HTTP request to itself; only the final hop returns the forced error',
        hops_remaining: hops,
        next_path: nextPath,
        forced_error: isError,
        status_code: statusCode,
        downstream_status_code: selfRes.statusCode,
        downstream_body: body
      });
    });
  }).on('error', function (err) {
    res.status(502).json({
      endpoint: '/sampling/tail/hops/non-propagating-error',
      error: err.message
    });
  });
});

var server = app.listen(PORT, function () {
  console.log('tail-sampling server running at http://127.0.0.1:' + PORT + '/');
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

var express = require('express');

var app = express();
var PORT = 8080;

var startTime = Date.now();
var SIMULATE_STARTUP_DELAY = process.env.SIMULATE_STARTUP_DELAY === 'true';
var STARTUP_DELAY_MS = 10000;
var READY_DELAY_MS = 12000;

app.get('/healthz/startup', function (req, res) {
  if (!SIMULATE_STARTUP_DELAY) {
    return res.status(200).json({ status: 'started', simulated: false });
  }
  var elapsed = Date.now() - startTime;
  if (elapsed >= STARTUP_DELAY_MS) {
    res.status(200).json({ status: 'started', elapsed_ms: elapsed });
  } else {
    res.status(503).json({ status: 'starting', remaining_ms: STARTUP_DELAY_MS - elapsed });
  }
});

app.get('/healthz/ready', function (req, res) {
  if (!SIMULATE_STARTUP_DELAY) {
    return res.status(200).json({ status: 'ready', simulated: false });
  }
  var elapsed = Date.now() - startTime;
  if (elapsed >= READY_DELAY_MS) {
    res.status(200).json({ status: 'ready', elapsed_ms: elapsed });
  } else {
    res.status(503).json({ status: 'not_ready', remaining_ms: READY_DELAY_MS - elapsed });
  }
});

app.get('/healthz/live', function (req, res) {
  res.status(200).json({ status: 'alive' });
});

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy' });
});

// No sampling rule targets this endpoint — traces are subject to the default pipeline behavior
app.get('/sampling/percentage/no-rule', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/percentage/no-rule', description: 'no sampling rule matches this endpoint' });
});

// A sampling rule targets this endpoint with 0% sampling rate
app.get('/sampling/percentage/sampled-0', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/percentage/sampled-0', description: 'sampling rule with 0% rate' });
});

// A sampling rule targets this endpoint with 50% sampling rate
app.get('/sampling/percentage/sampled-50', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/percentage/sampled-50', description: 'sampling rule with 50% rate' });
});

// A sampling rule targets this endpoint with 100% sampling rate
app.get('/sampling/percentage/sampled-100', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/percentage/sampled-100', description: 'sampling rule with 100% rate' });
});

// A sampling rule targets this endpoint with no percentage (fallback to default 0%)
app.get('/sampling/percentage/sampled-fallback', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/percentage/sampled-fallback', description: 'sampling rule with no percentage, falls back to 0%' });
});

// A sampling rule targets this route prefix with 50% sampling rate
app.get('/sampling/route/prefix', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/route/prefix', description: 'route prefix sampling rule with 50% rate' });
});

app.get('/sampling/route/prefix/part-one', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/route/prefix/part-one', description: 'matches the /sampling/route/prefix sampling rule' });
});

app.get('/sampling/route/prefix/part-one/part-two', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/route/prefix/part-one/part-two', description: 'matches the /sampling/route/prefix sampling rule with more route parts' });
});

// Sampling rules target these exact route templates, not the concrete request paths
app.get('/sampling/route/exact/:itemId', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/route/exact/:itemId', item_id: req.params.itemId, description: 'exact sampling rule for a templated route' });
});

app.get('/sampling/route/exact/:itemId/details/:detailId', function (req, res) {
  res.status(200).json({ endpoint: '/sampling/route/exact/:itemId/details/:detailId', item_id: req.params.itemId, detail_id: req.params.detailId, description: 'exact sampling rule for a templated route with multiple parameters' });
});

var server = app.listen(PORT, function () {
  console.log('head-sampling server running at http://127.0.0.1:' + PORT + '/');
  if (SIMULATE_STARTUP_DELAY) {
    console.log('Startup probe will pass after ' + (STARTUP_DELAY_MS / 1000) + 's');
    console.log('Readiness probe will pass after ' + (READY_DELAY_MS / 1000) + 's');
  } else {
    console.log('Startup delay simulation is disabled');
  }
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

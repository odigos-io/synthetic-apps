var express = require('express');

var PORT = parseInt(process.env.PORT || '8080', 10);
var WORKLOAD_KIND = process.env.WORKLOAD_KIND || 'unknown';

function podInfo() {
  return {
    workload_kind: WORKLOAD_KIND,
    hostname: process.env.HOSTNAME || null,
    pod_name: process.env.POD_NAME || process.env.HOSTNAME || null,
    pod_namespace: process.env.POD_NAMESPACE || null,
    node_name: process.env.NODE_NAME || null,
    timestamp: new Date().toISOString(),
  };
}

function runCronJobOnce() {
  var durationMs = parseInt(process.env.CRON_RUN_DURATION_MS || '50000', 10);
  if (isNaN(durationMs) || durationMs < 0) {
    durationMs = 50000;
  }
  var info = podInfo();
  console.log('workload-types cron job started: ' + JSON.stringify(info));
  setTimeout(function () {
    console.log('workload-types cron job exiting after ' + durationMs + 'ms');
    process.exit(0);
  }, durationMs);
}

function startHttpServer() {
  var app = express();

  app.get('/health', function (req, res) {
    res.status(200).json({ status: 'healthy', workload_kind: WORKLOAD_KIND });
  });

  app.get('/', function (req, res) {
    res.status(200).json({
      app: 'nodejs-workload-types',
      description: 'synthetic app for testing Odigos across Kubernetes workload kinds',
      ...podInfo(),
    });
  });

  var server = app.listen(PORT, function () {
    console.log(
      'workload-types server listening on port ' +
        PORT +
        ', workload_kind=' +
        WORKLOAD_KIND
    );
    console.log('pod info: ' + JSON.stringify(podInfo()));
  });

  process.on('SIGTERM', function () {
    console.log('SIGTERM received, shutting down...');
    server.close(function () {
      process.exit(0);
    });
  });
}

if (process.env.CRON_JOB === 'true') {
  runCronJobOnce();
} else {
  startHttpServer();
}

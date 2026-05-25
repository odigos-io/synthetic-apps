var express = require('express');

var app = express();
var PORT = parseInt(process.env.PORT || '8080', 10);
var SCENARIO = process.env.SCENARIO || 'ok';

function liveOk() {
  return SCENARIO === 'ok' || SCENARIO === 'live-ok-ready-fail' || SCENARIO === 'crash-exit';
}

function readyOk() {
  return SCENARIO === 'ok' || SCENARIO === 'crash-exit';
}

app.get('/healthz/live', function (req, res) {
  if (liveOk()) {
    return res.status(200).json({ status: 'alive', scenario: SCENARIO });
  }
  res.status(503).json({ status: 'not_alive', scenario: SCENARIO });
});

app.get('/healthz/ready', function (req, res) {
  if (readyOk()) {
    return res.status(200).json({ status: 'ready', scenario: SCENARIO });
  }
  res.status(503).json({ status: 'not_ready', scenario: SCENARIO });
});

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy', scenario: SCENARIO });
});

function scheduleCrashExitIfEnabled() {
  if (SCENARIO !== 'crash-exit') {
    return;
  }
  var delayMs = parseInt(process.env.EXIT_AFTER_MS || '8000', 10);
  var exitCode = parseInt(process.env.EXIT_CODE || '42', 10);
  var exitMessage =
    process.env.EXIT_MESSAGE ||
    'nodejs-k8s-health: intentional process exit for crash-loop testing';
  if (isNaN(delayMs) || delayMs < 1000) {
    delayMs = 8000;
  }
  if (isNaN(exitCode)) {
    exitCode = 42;
  }
  console.log(
    'crash-exit scheduled in ' +
      delayMs +
      'ms with exit code ' +
      exitCode +
      ' and message: ' +
      exitMessage
  );
  setTimeout(function () {
    console.error(exitMessage);
    process.exit(exitCode);
  }, delayMs);
}

var server = app.listen(PORT, function () {
  console.log('k8s-health server listening on port ' + PORT + ', scenario=' + SCENARIO);
  scheduleCrashExitIfEnabled();
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

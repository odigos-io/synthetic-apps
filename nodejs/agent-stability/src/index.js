var express = require('express');

var app = express();
var PORT = parseInt(process.env.PORT || '8080', 10);
var SCENARIO = process.env.SCENARIO || 'stable';
var CONTAINER = process.env.CONTAINER_NAME || 'app';
var instrumentationHandled = false;

function hasOdigosDistroEnv() {
  return Boolean(process.env.ODIGOS_DISTRO_NAME);
}

function exitOnInstrumentation(message) {
  console.error(
    '[' +
      CONTAINER +
      '] ' +
      message +
      ' (scenario=' +
      SCENARIO +
      ', ODIGOS_DISTRO_NAME=' +
      process.env.ODIGOS_DISTRO_NAME +
      ')'
  );
  process.exit(1);
}

function reactToOdigosInstrumentation() {
  if (!hasOdigosDistroEnv() || instrumentationHandled) {
    return;
  }
  instrumentationHandled = true;

  if (SCENARIO === 'stable' || SCENARIO === 'starts-after-instrumentation') {
    console.log(
      '[' +
        CONTAINER +
        '] running with Odigos instrumentation (scenario=' +
        SCENARIO +
        ', distro=' +
        process.env.ODIGOS_DISTRO_NAME +
        ')'
    );
    return;
  }

  if (SCENARIO === 'crash-on-odigos-immediate') {
    exitOnInstrumentation('crashing immediately because ODIGOS_DISTRO_NAME is set');
  }

  if (SCENARIO === 'crash-on-odigos-delayed') {
    var delayMs = parseInt(process.env.CRASH_AFTER_MS || '120000', 10);
    if (isNaN(delayMs) || delayMs < 0) {
      delayMs = 120000;
    }
    console.log(
      '[' +
        CONTAINER +
        '] ODIGOS_DISTRO_NAME detected; scheduled crash in ' +
        delayMs +
        'ms'
    );
    setTimeout(function () {
      exitOnInstrumentation('crashing after instrumentation delay');
    }, delayMs);
  }
}

function watchForLateInstrumentation() {
  if (SCENARIO === 'stable' || SCENARIO === 'starts-after-instrumentation') {
    return;
  }
  if (hasOdigosDistroEnv()) {
    return;
  }

  setInterval(function () {
    if (instrumentationHandled || !hasOdigosDistroEnv()) {
      return;
    }
    instrumentationHandled = true;
    reactToOdigosInstrumentation();
  }, 1000);
}

app.get('/healthz', function (req, res) {
  res.status(200).json({
    status: 'healthy',
    scenario: SCENARIO,
    container: CONTAINER,
    instrumented: hasOdigosDistroEnv(),
    distro: process.env.ODIGOS_DISTRO_NAME || null
  });
});

var server = app.listen(PORT, function () {
  console.log(
    'agent-stability listening on port ' +
      PORT +
      ' (scenario=' +
      SCENARIO +
      ', container=' +
      CONTAINER +
      ')'
  );
  reactToOdigosInstrumentation();
  watchForLateInstrumentation();
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

var http = require('http');
var express = require('express');
var httpFramework = require('./http-framework');
var plainHttp = require('./plain-http');
var examples = require('./default-examples');
var requestLog = require('./request-log');

var PORT = parseInt(process.env.PORT || '8080', 10);
var app = express();

app.disable('x-powered-by');
requestLog.attachExpressRequestLogging(app);

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy' });
});

app.get('/', function (req, res) {
  res.status(200).json({
    service: 'nodejs-url-templatization',
    servers: [
      {
        prefix: examples.PREFIX_FRAMEWORK,
        framework: 'express',
        notes: 'http.route is set by Express on server spans',
      },
      {
        prefix: examples.PREFIX_PLAIN,
        framework: 'node:http',
        notes: 'no framework route; URL templatization uses the raw path',
      },
    ],
    health: '/healthz',
  });
});

httpFramework.registerHttpFrameworkRoutes(app, PORT);

app.use(function (req, res) {
  examples.jsonResponse(res, 404, {
    error: 'not found',
    path: req.path,
    hint: 'Use /http-framework/* or /plain-http/*',
  });
});

var server = http.createServer(function (req, res) {
  if (plainHttp.handlePlainHttpRequest(req, res, PORT)) {
    return;
  }
  app(req, res);
});

server.listen(PORT, function () {
  console.log(
    'url-templatization listening on port ' +
      PORT +
      ' (' +
      examples.PREFIX_FRAMEWORK +
      ' via express, ' +
      examples.PREFIX_PLAIN +
      ' via node:http)'
  );
});

process.on('SIGTERM', function () {
  server.close(function () {
    process.exit(0);
  });
});

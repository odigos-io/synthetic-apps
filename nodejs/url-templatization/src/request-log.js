function logRequestHandled(entry) {
  var record = {
    event: 'request_handled',
    ts: new Date().toISOString(),
  };
  Object.keys(entry).forEach(function (key) {
    if (entry[key] !== undefined) {
      record[key] = entry[key];
    }
  });
  console.log(JSON.stringify(record));
}

function attachExpressRequestLogging(app) {
  app.use(function (req, res, next) {
    var startedAt = Date.now();
    res.on('finish', function () {
      var httpRoute;
      if (req.route) {
        httpRoute = (req.baseUrl || '') + req.route.path;
      }
      logRequestHandled({
        server_kind: req.url.indexOf('/http-framework') === 0 ? 'http-framework' : 'express',
        method: req.method,
        url: req.originalUrl || req.url,
        path: (req.baseUrl || '') + (req.path || ''),
        status: res.statusCode,
        http_route: httpRoute,
        params: req.params && Object.keys(req.params).length ? req.params : undefined,
        duration_ms: Date.now() - startedAt,
      });
    });
    next();
  });
}

function logPlainHttpHandled(req, statusCode, details) {
  logRequestHandled(
    Object.assign(
      {
        server_kind: 'plain-http',
        method: req.method,
        url: req.url,
        path: details.path,
        status: statusCode,
      },
      details
    )
  );
}

function logOutboundRequest(entry) {
  logRequestHandled(
    Object.assign(
      {
        direction: 'outbound',
      },
      entry
    )
  );
}

module.exports = {
  logRequestHandled: logRequestHandled,
  attachExpressRequestLogging: attachExpressRequestLogging,
  logPlainHttpHandled: logPlainHttpHandled,
  logOutboundRequest: logOutboundRequest,
};

var examples = require('./default-examples');
var requestLog = require('./request-log');

function requestPathname(req) {
  try {
    return new URL(req.url, 'http://localhost').pathname;
  } catch (err) {
    return req.url.split('?')[0] || '/';
  }
}

function respondPlain(req, res, statusCode, body, logDetails) {
  requestLog.logPlainHttpHandled(req, statusCode, logDetails);
  examples.jsonResponse(res, statusCode, body);
}

function handlePlainHttpRequest(req, res, port) {
  var pathname = requestPathname(req);
  var prefix = examples.PREFIX_PLAIN;

  if (!pathname.startsWith(prefix)) {
    return false;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    respondPlain(req, res, 405, { error: 'method not allowed', method: req.method }, {
      path: pathname,
      category: 'error',
      error: 'method_not_allowed',
    });
    return true;
  }

  if (pathname === prefix || pathname === prefix + '/') {
    respondPlain(req, res, 200, {
      server_kind: 'plain-http',
      framework: 'none',
      description: 'Use /plain-http/default and child paths. Spans lack framework http.route.',
    }, { path: pathname, category: 'index' });
    return true;
  }

  if (pathname === prefix + '/default') {
    var staticRouteDefs = examples.staticRoutes(prefix);
    var templatedRouteDefs = examples.templatedRoutes(prefix);
    respondPlain(req, res, 200, {
      server_kind: 'plain-http',
      framework: 'none',
      rule_set: 'default',
      description:
        'Incoming spans use the raw URL path (no framework http.route). Child paths demonstrate default URL templatization.',
      static_routes: staticRouteDefs,
      templated_routes: templatedRouteDefs.map(function (route) {
        return {
          id: route.id,
          pattern: route.pattern,
          example: route.examplePath,
          description: route.description,
        };
      }),
      outbound_triggers: [
        prefix + '/default/outbound/static',
        prefix + '/default/outbound/templated',
        prefix + '/default/outbound/all',
      ],
    }, { path: pathname, category: 'default_index', rule_set: 'default' });
    return true;
  }

  if (pathname === prefix + '/default/outbound/static') {
    handlePlainOutbound(req, res, port, prefix, 'static', pathname);
    return true;
  }

  if (pathname === prefix + '/default/outbound/templated') {
    handlePlainOutbound(req, res, port, prefix, 'templated', pathname);
    return true;
  }

  if (pathname === prefix + '/default/outbound/all') {
    handlePlainOutbound(req, res, port, prefix, 'all', pathname);
    return true;
  }

  var errorMatch = examples.errorRoutes(prefix).find(function (route) {
    return route.path === pathname;
  });
  if (errorMatch) {
    respondPlain(
      req,
      res,
      errorMatch.status,
      examples.inboundPayload('plain-http', 'default', 'http_error', pathname, {
        http_status: errorMatch.status,
        description: errorMatch.description,
      }),
      {
        path: pathname,
        category: 'http_error',
        rule_set: 'default',
        http_status: errorMatch.status,
      }
    );
    return true;
  }

  var staticMatch = examples.staticRoutes(prefix).find(function (route) {
    return route.path === pathname;
  });
  if (staticMatch) {
    if (req.method === 'HEAD') {
      requestLog.logPlainHttpHandled(req, 200, {
        path: pathname,
        category: 'static_exact',
        rule_set: 'default',
        segments: staticMatch.segments,
      });
      res.statusCode = 200;
      res.end();
      return true;
    }
    respondPlain(
      req,
      res,
      200,
      examples.inboundPayload('plain-http', 'default', 'static_exact', pathname, {
        segments: staticMatch.segments,
        description: staticMatch.description,
      }),
      {
        path: pathname,
        category: 'static_exact',
        rule_set: 'default',
        segments: staticMatch.segments,
      }
    );
    return true;
  }

  var templatedMatch = examples.matchTemplatedRoute(examples.templatedRoutes(prefix), pathname);
  if (templatedMatch) {
    if (req.method === 'HEAD') {
      requestLog.logPlainHttpHandled(req, 200, {
        path: pathname,
        category: 'templated',
        rule_set: 'default',
        matched_pattern: templatedMatch.route.pattern,
        params: templatedMatch.params,
      });
      res.statusCode = 200;
      res.end();
      return true;
    }
    respondPlain(
      req,
      res,
      200,
      examples.inboundPayload('plain-http', 'default', 'templated', pathname, {
        params: templatedMatch.params,
        matched_pattern: templatedMatch.route.pattern,
        description: templatedMatch.route.description,
      }),
      {
        path: pathname,
        category: 'templated',
        rule_set: 'default',
        matched_pattern: templatedMatch.route.pattern,
        params: templatedMatch.params,
      }
    );
    return true;
  }

  respondPlain(
    req,
    res,
    404,
    {
      server_kind: 'plain-http',
      path: pathname,
      error: 'not found',
    },
    { path: pathname, category: 'not_found', error: 'not_found' }
  );
  return true;
}

function handlePlainOutbound(req, res, port, prefix, kind, pathname) {
  var paths;
  if (kind === 'static') {
    paths = examples.staticRoutes(prefix).map(function (route) {
      return { path: route.path, method: 'GET' };
    });
  } else if (kind === 'templated') {
    paths = examples.templatedRoutes(prefix).map(function (route) {
      return { path: route.examplePath, method: 'GET' };
    });
  } else {
    paths = examples.outboundPathsForPrefix(prefix);
  }

  var baseUrl = examples.getSelfBaseUrl(port);
  examples.fireOutboundRequests(baseUrl, paths, requestLog.logOutboundRequest).then(function (results) {
    respondPlain(
      req,
      res,
      200,
      {
        server_kind: 'plain-http',
        category: 'outbound',
        self_base_url: baseUrl,
        requests: results,
      },
      {
        path: pathname,
        category: 'outbound',
        rule_set: 'default',
        outbound_kind: kind,
        outbound_count: results.length,
      }
    );
  });
}

module.exports = {
  handlePlainHttpRequest: handlePlainHttpRequest,
};

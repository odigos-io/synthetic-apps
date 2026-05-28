var PREFIX_FRAMEWORK = '/http-framework';
var PREFIX_PLAIN = '/plain-http';

function jsonResponse(res, statusCode, body) {
  var payload = JSON.stringify(body);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(payload);
}

function inboundPayload(serverKind, ruleSet, category, reqPath, extra) {
  var body = {
    server_kind: serverKind,
    rule_set: ruleSet,
    category: category,
    path: reqPath,
  };
  if (extra) {
    Object.keys(extra).forEach(function (key) {
      body[key] = extra[key];
    });
  }
  return body;
}

function staticRoutes(prefix) {
  return [
    {
      id: 'static-1',
      path: prefix + '/default/static/a',
      segments: 1,
      description: 'static exact match — one path segment after /default/static',
    },
    {
      id: 'static-2',
      path: prefix + '/default/static/a/b',
      segments: 2,
      description: 'static exact match — two path segments after /default/static',
    },
    {
      id: 'static-3',
      path: prefix + '/default/static/a/b/c',
      segments: 3,
      description: 'static exact match — three path segments after /default/static',
    },
  ];
}

function templatedRoutes(prefix) {
  return [
    {
      id: 'templated-1',
      pattern: prefix + '/default/templated/1/:seg1',
      examplePath: prefix + '/default/templated/1/foo',
      paramNames: ['seg1'],
      description: 'default templatization — one dynamic segment',
    },
    {
      id: 'templated-2',
      pattern: prefix + '/default/templated/2/:seg1/:seg2',
      examplePath: prefix + '/default/templated/2/foo/bar',
      paramNames: ['seg1', 'seg2'],
      description: 'default templatization — two dynamic segments',
    },
    {
      id: 'templated-3',
      pattern: prefix + '/default/templated/3/:seg1/:seg2/:seg3',
      examplePath: prefix + '/default/templated/3/foo/bar/baz',
      paramNames: ['seg1', 'seg2', 'seg3'],
      description: 'default templatization — three dynamic segments',
    },
  ];
}

function patternToRegExp(pattern) {
  var parts = pattern.split('/').filter(Boolean);
  var regexParts = parts.map(function (part) {
    if (part.charAt(0) === ':') {
      return '([^/]+)';
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp('^/' + regexParts.join('/') + '/?$');
}

function matchTemplatedRoute(routes, pathname) {
  for (var i = 0; i < routes.length; i++) {
    var route = routes[i];
    var regex = patternToRegExp(route.pattern);
    var match = pathname.match(regex);
    if (!match) {
      continue;
    }
    var params = {};
    route.paramNames.forEach(function (name, index) {
      params[name] = match[index + 1];
    });
    return { route: route, params: params };
  }
  return null;
}

function getSelfBaseUrl(port) {
  var base = process.env.SELF_BASE_URL;
  if (base) {
    return base.replace(/\/$/, '');
  }
  var host = process.env.SELF_HOST || '127.0.0.1';
  return 'http://' + host + ':' + port;
}

function fetchOutbound(url, method, logOutbound) {
  method = method || 'GET';
  var startedAt = Date.now();
  return fetch(url, { method: method }).then(function (response) {
    return response.text().then(function (text) {
      var parsed = text;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        /* keep raw text */
      }
      var result = {
        url: url,
        method: method,
        status: response.status,
        body: parsed,
      };
      if (logOutbound) {
        logOutbound({
          method: method,
          url: url,
          status: response.status,
          duration_ms: Date.now() - startedAt,
        });
      }
      return result;
    });
  });
}

function fireOutboundRequests(baseUrl, paths, logOutbound) {
  return Promise.all(
    paths.map(function (item) {
      var url = baseUrl + item.path;
      var method = item.method || 'GET';
      return fetchOutbound(url, method, logOutbound).catch(function (err) {
        if (logOutbound) {
          logOutbound({
            method: method,
            url: url,
            error: err.message,
          });
        }
        return {
          url: url,
          method: method,
          error: err.message,
        };
      });
    })
  );
}

function errorRoutes(prefix) {
  return [
    {
      id: 'error-404',
      path: prefix + '/default/errors/404',
      status: 404,
      description: 'fixed 404 path for skipOnError / non-success templatization tests',
    },
    {
      id: 'error-500',
      path: prefix + '/default/errors/500',
      status: 500,
      description: 'fixed 500 path for skipOnError / non-success templatization tests',
    },
  ];
}

function outboundPathsForPrefix(prefix) {
  var staticPaths = staticRoutes(prefix).map(function (route) {
    return { path: route.path, method: 'GET' };
  });
  var templatedPaths = templatedRoutes(prefix).map(function (route) {
    return { path: route.examplePath, method: 'GET' };
  });
  return staticPaths.concat(templatedPaths);
}

module.exports = {
  PREFIX_FRAMEWORK: PREFIX_FRAMEWORK,
  PREFIX_PLAIN: PREFIX_PLAIN,
  jsonResponse: jsonResponse,
  inboundPayload: inboundPayload,
  staticRoutes: staticRoutes,
  templatedRoutes: templatedRoutes,
  patternToRegExp: patternToRegExp,
  matchTemplatedRoute: matchTemplatedRoute,
  getSelfBaseUrl: getSelfBaseUrl,
  fireOutboundRequests: fireOutboundRequests,
  outboundPathsForPrefix: outboundPathsForPrefix,
  errorRoutes: errorRoutes,
};

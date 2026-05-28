var express = require('express');
var examples = require('./default-examples');
var requestLog = require('./request-log');

function registerHttpFrameworkRoutes(app, port) {
  var router = express.Router();
  var prefix = examples.PREFIX_FRAMEWORK;
  var staticRouteDefs = examples.staticRoutes(prefix);
  var templatedRouteDefs = examples.templatedRoutes(prefix);

  router.get('/default', function (req, res) {
    res.status(200).json({
      server_kind: 'http-framework',
      framework: 'express',
      rule_set: 'default',
      description:
        'Incoming spans should include http.route from Express. Use child paths under /default for static and templated URL examples.',
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
        prefix + '/default/outbound/static/:depth',
        prefix + '/default/outbound/templated/:depth',
      ],
    });
  });

  function fullRequestPath(req) {
    return req.baseUrl + req.path;
  }

  staticRouteDefs.forEach(function (route) {
    router.get(route.path.replace(prefix, ''), function (req, res) {
      res.status(200).json(
        examples.inboundPayload('http-framework', 'default', 'static_exact', fullRequestPath(req), {
          segments: route.segments,
          http_route: req.baseUrl + req.route.path,
          description: route.description,
        })
      );
    });
  });

  templatedRouteDefs.forEach(function (route) {
    var expressPath = route.pattern.replace(prefix, '');
    router.get(expressPath, function (req, res) {
      res.status(200).json(
        examples.inboundPayload('http-framework', 'default', 'templated', fullRequestPath(req), {
          params: req.params,
          http_route: req.baseUrl + req.route.path,
          description: route.description,
        })
      );
    });
  });

  function handleOutbound(req, res, paths) {
    var baseUrl = examples.getSelfBaseUrl(port);
    examples.fireOutboundRequests(baseUrl, paths, requestLog.logOutboundRequest).then(function (results) {
      res.status(200).json({
        server_kind: 'http-framework',
        category: 'outbound',
        self_base_url: baseUrl,
        requests: results,
      });
    });
  }

  router.get('/default/outbound/static', function (req, res) {
    handleOutbound(
      req,
      res,
      staticRouteDefs.map(function (route) {
        return { path: route.path, method: 'GET' };
      })
    );
  });

  router.get('/default/outbound/templated', function (req, res) {
    handleOutbound(
      req,
      res,
      templatedRouteDefs.map(function (route) {
        return { path: route.examplePath, method: 'GET' };
      })
    );
  });

  router.get('/default/outbound/all', function (req, res) {
    handleOutbound(req, res, examples.outboundPathsForPrefix(prefix));
  });

  router.get('/default/outbound/static/:depth', function (req, res) {
    var depth = req.params.depth;
    var route = staticRouteDefs.find(function (item) {
      return String(item.segments) === depth || item.id === 'static-' + depth;
    });
    if (!route) {
      return res.status(404).json({
        error: 'unknown static depth',
        valid_depths: ['1', '2', '3'],
      });
    }
    handleOutbound(req, res, [{ path: route.path, method: 'GET' }]);
  });

  examples.errorRoutes(prefix).forEach(function (route) {
    router.get(route.path.replace(prefix, ''), function (req, res) {
      res.status(route.status).json(
        examples.inboundPayload('http-framework', 'default', 'http_error', fullRequestPath(req), {
          http_status: route.status,
          http_route: req.baseUrl + req.route.path,
          description: route.description,
        })
      );
    });
  });

  router.get('/default/outbound/templated/:depth', function (req, res) {
    var depth = req.params.depth;
    var route = templatedRouteDefs.find(function (item) {
      return item.id === 'templated-' + depth;
    });
    if (!route) {
      return res.status(404).json({
        error: 'unknown templated depth',
        valid_depths: ['1', '2', '3'],
      });
    }
    handleOutbound(req, res, [{ path: route.examplePath, method: 'GET' }]);
  });

  app.use(prefix, router);
}

module.exports = {
  registerHttpFrameworkRoutes: registerHttpFrameworkRoutes,
};

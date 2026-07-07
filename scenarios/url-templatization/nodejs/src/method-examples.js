var PREFIX = '/plain-http/default/method';

var routes = {
  customRule: {
    id: 'custom-rule',
    path: PREFIX + '/custom-rule/items/widget',
    description:
      'Custom templatization rule matches widget segment; expect odigos.url_templatization.method=custom_rule.',
  },
  defaultHeuristic: {
    id: 'default-heuristic',
    path: PREFIX + '/default-heuristic/orders/1234567',
    description:
      'Long numeric segment triggers default heuristic; expect odigos.url_templatization.method=default_heuristic.',
  },
  unchanged: {
    id: 'unchanged',
    path: PREFIX + '/unchanged/catalog/widgets/tools',
    description:
      'All static segments left unchanged; expect odigos.url_templatization.method=unchanged.',
  },
  pathNormalization: {
    id: 'path-normalization',
    rawUrls: ['//', '///'],
    description:
      'Raw all-slash URL normalizes to /; expect odigos.url_templatization.method=path_normalization.',
  },
};

function isPathNormalizationRawUrl(url) {
  if (!url) {
    return false;
  }
  var path = url.split('?')[0];
  return path.length > 0 && path.replace(/\//g, '') === '';
}

function methodRouteList() {
  return [routes.customRule, routes.defaultHeuristic, routes.unchanged];
}

module.exports = {
  PREFIX: PREFIX,
  routes: routes,
  isPathNormalizationRawUrl: isPathNormalizationRawUrl,
  methodRouteList: methodRouteList,
};

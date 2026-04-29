var express = require('express');

var app = express();
var PORT = parseInt(process.env.PORT || '8080', 10);

function baseUrlWithoutTrailingSlash(raw) {
  if (!raw) {
    return '';
  }
  return String(raw).replace(/\/$/, '');
}

function firstNonEmpty() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v);
    }
  }
  return '';
}

function resolveGoBaseUrl() {
  // Prefer explicit base URL, but support kube-injected SERVICE_HOST/PORT
  // so the demo works even when cluster DNS is unhealthy.
  var explicit = baseUrlWithoutTrailingSlash(process.env.GO_BASE_URL);
  if (explicit) {
    return explicit;
  }

  var host = firstNonEmpty(
    process.env.GO_HOST,
    process.env.ML_HEAD_SAMPLING_GO_SERVICE_HOST
  );
  var port = firstNonEmpty(
    process.env.GO_PORT,
    process.env.ML_HEAD_SAMPLING_GO_SERVICE_PORT,
    '9090'
  );
  if (!host) {
    return 'http://127.0.0.1:' + port;
  }
  return 'http://' + host + ':' + port;
}

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy' });
});

// Calls the Go service and returns its response payload.
app.get('/ml/call-go', async function (req, res) {
  try {
    var goBaseUrl = resolveGoBaseUrl();
    var url = goBaseUrl + '/success';

    var upstreamRes = await fetch(url, {
      method: 'GET',
      headers: {
        'user-agent': 'multi-language-head-sampling-nodejs',
      },
    });

    var contentType = upstreamRes.headers.get('content-type') || '';
    var body;
    if (contentType.indexOf('application/json') >= 0) {
      body = await upstreamRes.json();
    } else {
      body = await upstreamRes.text();
    }

    if (!upstreamRes.ok) {
      return res.status(502).json({
        ok: false,
        error: 'go service returned non-2xx',
        go_url: url,
        go_status: upstreamRes.status,
        go_body: body,
      });
    }

    res.status(200).json({
      ok: true,
      go_url: url,
      go_status: upstreamRes.status,
      go_body: body,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
});

app.listen(PORT, function () {
  console.log('multi-language nodejs app listening at http://127.0.0.1:' + PORT + '/');
  console.log('GO_BASE_URL=' + resolveGoBaseUrl());
});


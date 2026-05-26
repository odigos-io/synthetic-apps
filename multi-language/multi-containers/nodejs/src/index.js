var express = require('express');

var app = express();
var PORT = parseInt(process.env.PORT || '8080', 10);

app.get('/healthz', function (req, res) {
  res.status(200).json({ status: 'healthy', language: 'nodejs' });
});

app.listen(PORT, function () {
  console.log('multi-containers nodejs listening on port ' + PORT);
});

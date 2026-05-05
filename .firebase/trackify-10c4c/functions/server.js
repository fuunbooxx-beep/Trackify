const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrtrackify10c4c = onRequest({"region":"europe-west2"}, (req, res) => server.then(it => it.handle(req, res)));
  
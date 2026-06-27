const { onRequest } = require('firebase-functions/v2/https');

const health = onRequest((req, res) => {
  res.status(200).json({
    ok: true,
    service: 'capstone-functions',
    now: new Date().toISOString(),
  });
});

module.exports = {
  health,
};

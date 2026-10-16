// Express 4 reicht Rejections aus async-Handlern nicht an die Fehler-Middleware weiter.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { wrap };

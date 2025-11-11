// api/orders/init.js
const { randomUUID } = require('crypto');
const products = require('../../shared/products.json');

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  try {
    const body = await readJson(req);
    const { productId, buyerId } = body || {};
    const p = products.find(x => x.id === productId);
    if (!p) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify({ ok:false, message:'invalid productId' }));
    }

    const orderId = randomUUID();
    // TODO: 운영에서는 DB에 주문(status=requested) 저장 권장

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      order: {
        orderId,
        productId: p.id,
        goodname: p.name,
        priceKRW: p.priceKRW,
        buyerId
      }
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok:false, message: e?.message || 'server error' }));
  }
};

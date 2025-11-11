// api/pay/feedback.js
// Vercel Serverless Function (CommonJS). PayApp는 application/x-www-form-urlencoded로 POST합니다.
const products = require('../../shared/products.json');

function readFormBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try {
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        resolve(obj);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// 임시 보관 (서버리스 특성상 영속적이지 않음) → 운영에서는 DB 사용
const recentLogs = [];

module.exports = async (req, res) => {
  // ✅ GET: 임시 로그 확인용
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok:true, logs: recentLogs.slice(-100) }));
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const data = await readFormBody(req);
  const { pay_state, price, goodname, buyerid, var1, var2, mul_no } = data; // var1=orderId, var2=productId
  recentLogs.push({ t: Date.now(), pay_state, goodname, price, buyerid, var1, var2, mul_no });
  if (recentLogs.length > 100) recentLogs.shift();

  // 1) 최초 통지: 반드시 SUCCESS 로 응답 (결제 진행 허용)
  if (String(pay_state) === '1') {
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  // 2) 결제 완료: 상품/금액 검증 후 코인 지급
  if (['2', 'paid', 'success'].includes(String(pay_state))) {
    const p = products.find(x => x.id === var2);
    const paid = Number(price || 0);
    if (!p) {
      console.warn('[WARN] Unknown productId:', var2);
    } else if (paid !== Number(p.priceKRW)) {
      console.warn('[WARN] Price mismatch:', { paid, expected: p.priceKRW, productId: var2 });
      // 운영정책: 지급 보류 또는 관리자 검토
    } else {
      // ✅ 여기서 실제 코인 지급 (DB 반영)
      const credit = (p.coins || 0) + (p.bonus || 0);
      console.log('[CREDIT COINS]', { orderId: var1, buyerid, productId: var2, credit });
    }
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  // 3) 취소/환불
  if (['99', 'cancel'].includes(String(pay_state))) {
    // TODO: 주문 상태 취소/환불 반영
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  res.statusCode = 200;
  res.end('SUCCESS');
};

// api/pay/feedback.js
// Vercel Serverless Function (CommonJS). PayApp는 application/x-www-form-urlencoded로 POST합니다.

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

// 데모용 메모리 저장소 (서버리스 특성상 상태는 유지되지 않을 수 있음 → 운영에서는 DB 사용)
const recentLogs = [];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  const data = await readFormBody(req);
  const { pay_state, goodname, price, buyerid, var1, mul_no } = data;

  // 로그 남기기 (관찰용)
  recentLogs.push({ t: Date.now(), pay_state, goodname, price, buyerid, var1, mul_no });
  if (recentLogs.length > 20) recentLogs.shift();
  console.log('[PayApp feedback]', data);

  // 1) 최초 통지 (결제진행 허용)
  if (String(pay_state) === '1') {
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  // 2) 결제 완료 (여기서 코인 지급! → 운영에선 DB, 인증 등 필수)
  if (['2', 'paid', 'success'].includes(String(pay_state))) {
    // TODO: DB에 주문 'paid' 처리 후 코인 지급
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  // 3) 취소/환불
  if (['99', 'cancel'].includes(String(pay_state))) {
    res.statusCode = 200;
    return res.end('SUCCESS');
  }

  // 그 외
  res.statusCode = 200;
  res.end('SUCCESS');
};

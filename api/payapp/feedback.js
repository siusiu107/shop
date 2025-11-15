// /api/payapp/feedback.js
import admin from 'firebase-admin';

const svc = process.env.FIREBASE_SERVICE_ACCOUNT; // 서비스계정 JSON 전체
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(svc)),
    databaseURL: 'https://siu-studio-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}
const db = admin.database();
const LINKVAL = process.env.PAYAPP_LINKVAL;      // PayApp 연동 VALUE(비밀)

const PACKS = {
  'eco-100':  { priceKRW: 1100,  ecoins: 100,  title: '이벤트코인 100개' },
  'eco-600':  { priceKRW: 5500,  ecoins: 600,  title: '이벤트코인 600개' },
  'eco-1300': { priceKRW: 11000, ecoins: 1300, title: '이벤트코인 1300개' },
  'eco-2800': { priceKRW: 22000, ecoins: 2800, title: '이벤트코인 2800개' },
};

export default async function handler(req, res) {
  try {
    const p = req.method === 'POST' ? (req.body || {}) : {};
    // 1) 검증
    if (!p || String(p.linkval) !== LINKVAL) return res.status(403).send('FORBIDDEN');
    if (String(p.userid || '').toLowerCase() !== 'siustudio') return res.status(400).send('BAD_USER');

    const payStateRaw = String(p.pay_state || p.PAY_STATE || p.state || '');
    const payState = payStateRaw.toLowerCase();
    const approved = (payState === '2' || payState === '승인' || payState === 'success');
    if (!approved) return res.status(200).send('IGNORED');

    const price = Number(p.price || p.PCD_PAY_TOTAL || p.amount || 0);
    let meta = {};
    try { meta = JSON.parse(p.var1 || '{}'); } catch {}
    const { uid, packId } = meta;
    const pack = PACKS[packId];
    if (!uid || !pack) return res.status(200).send('BAD_META');
    if (Number(pack.priceKRW) !== price) return res.status(200).send('PRICE_MISMATCH');

    // (옵션) 중복 처리 방지: 동일 거래키(tid/oid 등)로 재진입 방지
    const tid = String(p.tid || p.PCD_PAY_OID || p.PCD_PAY_REQKEY || '');
    if (tid) {
      const dupRef = db.ref(`payments/payapp/${tid}`);
      const dup = await dupRef.get();
      if (dup.exists()) return res.status(200).send('DUP');
      await dupRef.set({ uid, packId, price, at: Date.now() });
    }

    // 2) 유저 본경로 찾기 (userServerMap → users/{server}/{id})
    const mapSnap = await db.ref(`userServerMap/${uid}`).get();
    if (!mapSnap.exists()) return res.status(200).send('NO_USER_MAP');
    const { server, id } = mapSnap.val() || {};
    if (!server || !id) return res.status(200).send('BAD_USER_MAP');

    // 3) 우편 생성 (게임과 동일 포맷)
    const mailId = `mail_${Date.now()}_${Math.floor(Math.random()*9999)}`;
    const mailData = {
      subject: '이벤트코인 결제 완료',
      body: `${pack.title} 결제가 확인되었습니다!\n게임 우편함에서 수령해 주세요.`,
      from: 'system@siustudio.kro.kr',
      sentAt: Date.now(),
      rewards: { eventCoins: pack.ecoins }
    };

    await db.ref(`users/${server}/${id}/mailbox/${mailId}`).set(mailData); // ← 게임이 읽는 경로
    return res.status(200).send('SUCCESS');
  } catch (e) {
    console.error('payapp feedback error', e);
    return res.status(500).send('ERROR');
  }
}


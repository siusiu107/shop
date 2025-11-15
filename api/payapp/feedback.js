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

// ⚠️ index.html 의 PACKS와 반드시 동일한 구성이어야 합니다.
const PACKS = {
  'eco-100':  { priceKRW: 1100,  ecoins: 120,  title: '이벤트코인 스타터 번들' },
  'eco-300':  { priceKRW: 3300,  ecoins: 380,  title: '이벤트코인 묶음' },
  'eco-700':  { priceKRW: 7700,  ecoins: 950,  title: '이벤트코인 자루' },
  'eco-1500': { priceKRW: 15000, ecoins: 2100, title: '이벤트코인 상자' },
  'eco-4000': { priceKRW: 39000, ecoins: 6000, title: '이벤트코인 보물상자' },
};

export default async function handler(req, res) {
  try {
    // 브라우저에서 GET으로 열어보면 단순 응답만
    if (req.method === 'GET') {
      return res.status(200).send('SUCCESS');
    }

    const p = req.method === 'POST' ? (req.body || {}) : {};
    console.log('PAYAPP FEEDBACK BODY:', p);

    // 1) 기본 검증 (디버그 중에는 조금 느슨하게)
    if (!p) return res.status(200).send('SUCCESS');

    if (p.linkval && String(p.linkval) !== LINKVAL) {
      console.log('BAD LINKVAL:', p.linkval);
      return res.status(403).send('FORBIDDEN');
    }

    if (p.userid && String(p.userid).toLowerCase() !== 'siustudio') {
      console.log('BAD USERID:', p.userid);
      return res.status(400).send('BAD_USER');
    }

    const payStateRaw = String(p.pay_state || p.PAY_STATE || p.state || '');
    const payState = payStateRaw.toLowerCase();

    // pay_state === '1' (요청 생성) 은 승인 전 단계로 보고, 나머지는 승인 처리
    const approved = (payState !== '1' && payState !== '요청');

    // 승인 전 단계는 단순 SUCCESS 응답만
    if (!approved) {
      return res.status(200).send('SUCCESS');
    }

    const price = Number(p.price || p.PCD_PAY_TOTAL || p.amount || 0);
    let meta = {};
    try { meta = JSON.parse(p.var1 || '{}'); } catch (e) {
      console.log('VAR1 PARSE ERROR:', p.var1, e);
    }
    const { uid, packId } = meta;
    const pack = PACKS[packId];

    if (!uid || !pack) {
      console.log('BAD_META:', meta);
      return res.status(200).send('BAD_META');
    }

    // 테스트 중에는 가격 체크 잠시 끌 수도 있음
    if (Number(pack.priceKRW) !== price) {
      console.log('PRICE_MISMATCH:', price, 'vs', pack.priceKRW);
      return res.status(200).send('PRICE_MISMATCH');
    }

    // (옵션) 중복 처리 방지: 동일 거래키로 재진입 방지
    const tid = String(p.tid || p.PCD_PAY_OID || p.PCD_PAY_REQKEY || '');
    if (tid) {
      const dupRef = db.ref(`payments/payapp/${tid}`);
      const dup = await dupRef.get();
      if (dup.exists()) return res.status(200).send('DUP');
      await dupRef.set({ uid, packId, price, at: Date.now() });
    }

    // 2) 유저 본경로 찾기 (userServerMap → users/{server}/{id})
    const mapSnap = await db.ref(`userServerMap/${uid}`).get();
    if (!mapSnap.exists()) {
      console.log('NO_USER_MAP for uid', uid);
      return res.status(200).send('NO_USER_MAP');
    }
    const { server, id } = mapSnap.val() || {};
    if (!server || !id) {
      console.log('BAD_USER_MAP:', mapSnap.val());
      return res.status(200).send('BAD_USER_MAP');
    }

    // 3) 우편 생성
    const mailId = `mail_${Date.now()}_${Math.floor(Math.random() * 9999)}`;
    const mailData = {
      subject: '이벤트코인 결제 완료',
      body: `${pack.title} 결제가 확인되었습니다!\n게임 우편함에서 수령해 주세요.`,
      from: 'system@siustudio.kro.kr',
      sentAt: Date.now(),
      rewards: { eventCoins: pack.ecoins }
    };

    await db.ref(`users/${server}/${id}/mailbox/${mailId}`).set(mailData);
    console.log('MAIL WRITTEN to', `users/${server}/${id}/mailbox/${mailId}`);
    return res.status(200).send('SUCCESS');
  } catch (e) {
    console.error('payapp feedback error', e);
    return res.status(500).send('ERROR');
  }
}

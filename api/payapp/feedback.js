// /api/payapp/feedback.js
// PayApp 결제 콜백(Feedback) 처리
// A안: 결제 완료 시 "우편함"이 아니라 구매자 UID의 gameData.eventCoins를 바로 증가시킵니다.
// - android/uid/{uid}/gameData/eventCoins  (transaction)
// - 곡괭이 영구 패키지는 android/uid/{uid}/perks/pickaxe (transaction)

import admin from 'firebase-admin';

const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!admin.apps.length) {
  if (!svc) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env가 설정되어 있지 않습니다.');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(svc)),
    databaseURL:
      'https://siu-studio-default-rtdb.asia-southeast1.firebasedatabase.app',
  });
}
const db = admin.database();

// PayApp 판매자 설정의 "연동 VALUE" (가능하면 반드시 설정해 두세요)
const LINKVAL = process.env.PAYAPP_LINKVAL || '';

// ⚠ index.html 의 PACKS와 반드시 동일하게!
const PACKS = {
  // 이벤트코인
  'eco-120': { kind: 'eco', priceKRW: 1100, ecoins: 120, title: '스타터 묶음' },
  'eco-300': { kind: 'eco', priceKRW: 2200, ecoins: 300, title: '이벤트코인 작은 자루' },
  'eco-700': { kind: 'eco', priceKRW: 4400, ecoins: 700, title: '이벤트코인 중형 자루' },
  'eco-1600': { kind: 'eco', priceKRW: 8800, ecoins: 1600, title: '이벤트코인 대형 자루' },
  'eco-3600': { kind: 'eco', priceKRW: 18000, ecoins: 3600, title: '이벤트코인 보물 상자' },
  'eco-8000': { kind: 'eco', priceKRW: 39000, ecoins: 8000, title: '이벤트코인 우주 창고' },

  // 새 이벤트코인 상품
  'eco-5000': { kind: 'eco', priceKRW: 25000, ecoins: 5000, title: '코스믹 번들' },
  'eco-12000': { kind: 'eco', priceKRW: 69000, ecoins: 12000, title: '갤럭시 창고' },

  // 곡괭이 영구 패키지
  'perk-stone': {
    kind: 'perk',
    perkType: 'pickaxe',
    perkTier: 1,
    priceKRW: 3000,
    title: '돌 곡괭이 패키지',
    resourceMult: 2,
    coinMult: 2,
    productionMult: 1,
  },
  'perk-iron': {
    kind: 'perk',
    perkType: 'pickaxe',
    perkTier: 2,
    priceKRW: 7000,
    title: '철 곡괭이 패키지',
    resourceMult: 3,
    coinMult: 3,
    productionMult: 2,
  },
  'perk-diamond': {
    kind: 'perk',
    perkType: 'pickaxe',
    perkTier: 3,
    priceKRW: 25600,
    title: '다이아몬드 곡괭이 패키지',
    resourceMult: 5,
    coinMult: 5,
    productionMult: 7,
  },
};

export const config = {
  api: {
    bodyParser: true, // x-www-form-urlencoded 그대로 받아도 됨
  },
};

function asInt(n, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.floor(v);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  console.log('[payapp] feedback body:', body);

  // PayApp에서 오는 주요 필드들
  const {
    price,
    buyerid,
    var1,
    linkval,
    linkVal,
    value,
    pay_state, // 결제 상태 (1:요청, 4:결제완료 등)
    mul_no, // 결제요청번호(유니크 키)
  } = body;

  // linkval 검증 (연동 VALUE)
  const linkToken = linkval || linkVal || value || '';
  if (LINKVAL && linkToken !== LINKVAL) {
    console.error('[payapp] invalid linkval:', linkToken);
    return res.status(400).send('INVALID_LINKVAL');
  }

  // 결제 상태
  const payState = asInt(pay_state || 0, 0);

  // JS API에서 feedbackurl을 쓰면 pay_state=1(요청) 이 먼저 한 번 옴.
  // 이때도 반드시 SUCCESS 를 돌려줘야 결제가 진행됨.
  if (!payState) {
    console.log('[payapp] missing/invalid pay_state, just SUCCESS');
    return res.status(200).send('SUCCESS');
  }

  // 아직 결제 완료 전(요청/대기/취소 등) → 처리 없이 OK만
  if (payState !== 4) {
    console.log('[payapp] pay_state != 4, state=', payState);
    return res.status(200).send('SUCCESS');
  }

  // 여기까지 왔으면 pay_state === 4 (결제완료)
  if (!mul_no) {
    console.error('[payapp] missing mul_no');
    return res.status(400).send('MISSING_MUL_NO');
  }

  let meta = {};
  try {
    if (typeof var1 === 'string') meta = JSON.parse(var1);
    else if (var1 && typeof var1 === 'object') meta = var1;
  } catch (e) {
    console.error('[payapp] failed to parse var1:', e);
  }

  const packId = meta.packId;
  const pack = PACKS[packId];
  if (!pack) {
    console.error('[payapp] unknown packId:', packId);
    return res.status(200).send('SUCCESS');
  }

  const reqPrice = asInt(price || meta.priceKRW || 0, 0);
  if (pack.priceKRW && reqPrice !== pack.priceKRW) {
    console.error('[payapp] price mismatch', packId, reqPrice, 'expected', pack.priceKRW);
    return res.status(400).send('PRICE_MISMATCH');
  }

  const uid = meta.uid || buyerid;
  if (!uid) {
    console.error('[payapp] missing uid (meta.uid/buyerid)');
    return res.status(400).send('MISSING_UID');
  }

  const payRef = db.ref(`payments/payapp/${mul_no}`);

  try {
    // 1) 중복 처리 방지 (mul_no 기준) + 예약(트랜잭션)
    const reserve = await payRef.transaction((cur) => {
      if (cur) return; // 이미 처리/예약됨 → committed=false
      return {
        uid,
        packId,
        priceKRW: pack.priceKRW,
        payState,
        status: 'processing',
        createdAt: admin.database.ServerValue.TIMESTAMP,
      };
    });

    if (!reserve.committed) {
      console.log('[payapp] already processed mul_no:', mul_no);
      return res.status(200).send('SUCCESS');
    }

    // 2) 상품 종류별 처리 (A안)
    if (pack.kind === 'eco') {
      const eco = asInt(pack.ecoins || 0, 0);
      if (eco > 0) {
        const ecoRef = db.ref(`android/uid/${uid}/gameData/eventCoins`);
        const tx = await ecoRef.transaction((cur) => {
          const base = asInt(cur || 0, 0);
          return Math.max(0, base) + eco;
        });

        const newTotal = tx.snapshot.exists() ? asInt(tx.snapshot.val(), 0) : null;

        // (선택) 마지막 결제 메타 저장 - 디버그/지원용
        await db.ref(`android/uid/${uid}/gameData/lastPurchase`).set({
          kind: 'eco',
          packId,
          ecoins: eco,
          priceKRW: pack.priceKRW,
          mulNo: mul_no,
          at: admin.database.ServerValue.TIMESTAMP,
          totalAfter: newTotal,
          src: 'payapp',
        });

        console.log('[payapp] eco applied:', { uid, packId, eco, mul_no, newTotal });
      }
    } else if (pack.kind === 'perk' && pack.perkType === 'pickaxe') {
      // 곡괭이 영구 패키지: android/uid/{uid}/perks/pickaxe 에 티어 저장 (더 높은 티어만 덮어쓰기)
      const perkRef = db.ref(`android/uid/${uid}/perks/pickaxe`);
      await perkRef.transaction((cur) => {
        const curTier = cur && cur.tier ? asInt(cur.tier, 0) : 0;
        if (asInt(pack.perkTier, 0) <= curTier) return cur;

        return {
          tier: asInt(pack.perkTier, 0),
          resourceMult: asInt(pack.resourceMult, 1),
          coinMult: asInt(pack.coinMult, 1),
          productionMult: asInt(pack.productionMult, 1),
          lastPackId: packId,
          updatedAt: admin.database.ServerValue.TIMESTAMP,
          src: 'payapp',
        };
      });

      await db.ref(`android/uid/${uid}/gameData/lastPurchase`).set({
        kind: 'perk',
        packId,
        perkType: 'pickaxe',
        perkTier: asInt(pack.perkTier, 0),
        priceKRW: pack.priceKRW,
        mulNo: mul_no,
        at: admin.database.ServerValue.TIMESTAMP,
        src: 'payapp',
      });

      console.log('[payapp] perk updated:', { uid, packId, mul_no });
    }

    // 3) 완료 표시
    await payRef.update({
      status: 'done',
      appliedAt: admin.database.ServerValue.TIMESTAMP,
    });

    // PayApp이 요구하는 성공 응답
    return res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('[payapp] handler error', err);

    // 예약은 됐는데 처리 실패한 경우 추적 가능하게 남김
    try {
      await payRef.update({
        status: 'error',
        errorAt: admin.database.ServerValue.TIMESTAMP,
        errorMsg: String(err?.message || err),
      });
    } catch (_) {}

    return res.status(500).send('ERROR');
  }
}

// /api/payapp/feedback.js
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

// PayApp 판매자 설정의 "연동 VALUE"
const LINKVAL = process.env.PAYAPP_LINKVAL || '';

// ⚠ index.html 의 PACKS와 반드시 동일하게!
const PACKS = {
  // 이벤트코인
  'eco-120': {
    kind: 'eco',
    priceKRW: 1100,
    ecoins: 120,
    title: '스타터 묶음',
  },
  'eco-300': {
    kind: 'eco',
    priceKRW: 2200,
    ecoins: 300,
    title: '이벤트코인 작은 자루',
  },
  'eco-700': {
    kind: 'eco',
    priceKRW: 4400,
    ecoins: 700,
    title: '이벤트코인 중형 자루',
  },
  'eco-1600': {
    kind: 'eco',
    priceKRW: 8800,
    ecoins: 1600,
    title: '이벤트코인 대형 자루',
  },
  'eco-3600': {
    kind: 'eco',
    priceKRW: 18000,
    ecoins: 3600,
    title: '이벤트코인 보물 상자',
  },
  'eco-8000': {
    kind: 'eco',
    priceKRW: 39000,
    ecoins: 8000,
    title: '이벤트코인 우주 창고',
  },

  // 🔹 새로 추가한 이벤트코인 상품들 (프론트와 동일)
  'eco-5000': {
    kind: 'eco',
    priceKRW: 25000,
    ecoins: 5000,
    title: '코스믹 번들',
  },
  'eco-12000': {
    kind: 'eco',
    priceKRW: 69000,
    ecoins: 12000,
    title: '갤럭시 창고',
  },

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};

  // 디버그용(원하면 잠깐 켜 두고 Vercel 로그로 보기)
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
    // PayApp 에서는 'SUCCESS' 가 아니면 실패로 인식 → 굳이 재시도 유도하고 싶으면 이렇게 둠
    return res.status(400).send('INVALID_LINKVAL');
  }

  // 결제 상태
  const payState = Number(pay_state || 0);

  // JS API에서 feedbackurl을 쓰면 pay_state=1(요청) 이 먼저 한 번 옴.
  // 이때도 반드시 SUCCESS 를 돌려줘야 결제가 진행됨.
  if (!payState || Number.isNaN(payState)) {
    console.log('[payapp] missing pay_state, just SUCCESS');
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
    if (typeof var1 === 'string') {
      meta = JSON.parse(var1);
    } else if (var1 && typeof var1 === 'object') {
      meta = var1;
    }
  } catch (e) {
    console.error('[payapp] failed to parse var1:', e);
  }

  const packId = meta.packId;
  const pack = PACKS[packId];
  if (!pack) {
    console.error('[payapp] unknown packId:', packId);
    // 잘못된 설정이지만 PayApp에는 성공으로 알려서 재시도 폭주 안 나게 처리
    return res.status(200).send('SUCCESS');
  }

  const reqPrice = Number(price || meta.priceKRW || 0);
  if (pack.priceKRW && reqPrice !== pack.priceKRW) {
    console.error(
      '[payapp] price mismatch',
      packId,
      reqPrice,
      'expected',
      pack.priceKRW,
    );
    return res.status(400).send('PRICE_MISMATCH');
  }

  const uid = meta.uid || buyerid;
  if (!uid) {
    console.error('[payapp] missing uid (meta.uid/buyerid)');
    return res.status(400).send('MISSING_UID');
  }

  try {
    // 1) 중복 처리 방지 (mul_no 기준)
    const payRef = db.ref(`payments/payapp/${mul_no}`);
    const paySnap = await payRef.once('value');

    if (paySnap.exists()) {
      console.log('[payapp] already processed mul_no:', mul_no);
      // 이미 처리된 거래 → 그냥 SUCCESS
      return res.status(200).send('SUCCESS');
    }

    await payRef.set({
      uid,
      packId,
      priceKRW: pack.priceKRW,
      payState,
      createdAt: admin.database.ServerValue.TIMESTAMP,
    });

    // 2) userServerMap에서 server/id 찾기
    const mapSnap = await db.ref(`userServerMap/${uid}`).once('value');
    if (!mapSnap.exists()) {
      console.error('[payapp] userServerMap not found for uid:', uid);
      return res.status(200).send('SUCCESS');
    }
    const mapVal = mapSnap.val() || {};
    const server = mapVal.server;
    const id = mapVal.id;
    if (!server || !id) {
      console.error('[payapp] invalid userServerMap entry:', uid, mapVal);
      return res.status(200).send('SUCCESS');
    }

    // 3) 상품 종류별 처리
    if (pack.kind === 'eco') {
      // ▶ 이벤트코인 우편함 지급
      const eco = Number(pack.ecoins || 0);
      if (eco > 0) {
        const mailboxRef = db.ref(`users/${server}/${id}/mailbox`);
        const newKey = mailboxRef.push().key;
        const now = Date.now();
        const mail = {
          title: pack.title,
          body: `PayApp 결제로 이벤트코인 ${eco}개가 지급되었습니다.`,
          type: 'system',
          rewards: {
            eventCoins: eco,
          },
          meta: {
            packId,
            ecoins: eco,
            priceKRW: pack.priceKRW,
            mulNo: mul_no,
            src: 'payapp',
          },
          sentAt: now,
          createdAt: now,
          unread: true,
        };
        await mailboxRef.child(newKey).set(mail);
        console.log(
          '[payapp] eco mail created:',
          uid,
          packId,
          'eco =',
          eco,
          'mul_no =',
          mul_no,
        );
      }
    } else if (pack.kind === 'perk' && pack.perkType === 'pickaxe') {
      // ▶ 곡괭이 영구 패키지: perks/pickaxe에 티어 저장 (더 높은 티어만 덮어쓰기)
      const perkRef = db.ref(`users/${server}/${id}/perks/pickaxe`);
      await perkRef.transaction((cur) => {
        const curTier = cur && cur.tier ? Number(cur.tier) : 0;
        if (pack.perkTier <= curTier) {
          console.log(
            '[payapp] perk tier not upgraded',
            { uid, curTier, newTier: pack.perkTier },
          );
          return cur;
        }
        return {
          tier: pack.perkTier,
          resourceMult: pack.resourceMult,
          coinMult: pack.coinMult,
          productionMult: pack.productionMult,
          lastPackId: packId,
          updatedAt: Date.now(),
          src: 'payapp',
        };
      });
      console.log('[payapp] perk updated:', uid, packId);
    }

    // PayApp이 요구하는 성공 응답
    return res.status(200).send('SUCCESS');
  } catch (err) {
    console.error('[payapp] handler error', err);
    return res.status(500).send('ERROR');
  }
}

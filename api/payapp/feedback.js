// /api/payapp/feedback.js
import admin from 'firebase-admin';

const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!admin.apps.length) {
  if (!svc) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT env가 설정되어 있지 않습니다.');
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(svc)),
    databaseURL: 'https://siu-studio-default-rtdb.asia-southeast1.firebasedatabase.app'
  });
}
const db = admin.database();

// PayApp 상점 설정에서 지정한 비밀 값
const LINKVAL = process.env.PAYAPP_LINKVAL || '';

// ⚠ index.html 의 PACKS와 반드시 동일
const PACKS = {
  // 이벤트코인
  'eco-120':  { kind:'eco',  priceKRW:1100,  ecoins:120,  title:'스타터 묶음' },
  'eco-300':  { kind:'eco',  priceKRW:2200,  ecoins:300,  title:'이벤트코인 작은 자루' },
  'eco-700':  { kind:'eco',  priceKRW:4400,  ecoins:700,  title:'이벤트코인 중형 자루' },
  'eco-1600': { kind:'eco',  priceKRW:8800,  ecoins:1600, title:'이벤트코인 대형 자루' },
  'eco-3600': { kind:'eco',  priceKRW:18000, ecoins:3600, title:'이벤트코인 보물 상자' },
  'eco-8000': { kind:'eco',  priceKRW:39000, ecoins:8000, title:'이벤트코인 우주 창고' },

  // 곡괭이 영구 패키지
  'perk-stone': {
    kind:'perk', perkType:'pickaxe', perkTier:1,
    priceKRW:3000, title:'돌 곡괭이 패키지',
    resourceMult:2, coinMult:2, productionMult:1
  },
  'perk-iron': {
    kind:'perk', perkType:'pickaxe', perkTier:2,
    priceKRW:7000, title:'철 곡괭이 패키지',
    resourceMult:3, coinMult:3, productionMult:2
  },
  'perk-diamond': {
    kind:'perk', perkType:'pickaxe', perkTier:3,
    priceKRW:25600, title:'다이아몬드 곡괭이 패키지',
    resourceMult:5, coinMult:5, productionMult:7
  }
};

// 필요하다면 bodyParser 옵션 조정 가능
export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};

  // PayApp에서 넘어오는 필드들 (필드명은 본인 설정/문서에 맞게 확인 필요)
  const {
    result,      // 'success' 등
    price,       // 결제 금액
    tid,         // 거래 ID
    buyerid,     // 프론트에서 setParam('buyerid', uid)
    var1,        // 프론트에서 setParam('var1', JSON.stringify(meta))
    linkval,     // 상점 설정의 link_value (이름은 설정에 따라 다를 수 있음)
    linkVal,
    value
  } = body;

  // 비밀값 검증 (설정에 따라 linkval / value 중 실제 넘어오는 필드를 맞춰줘야 함)
  const linkToken = linkval || linkVal || value || '';
  if (LINKVAL && linkToken !== LINKVAL) {
    console.error('[payapp] invalid linkval', linkToken);
    return res.status(400).send('INVALID_LINKVAL');
  }

  if (!result || String(result).toLowerCase() !== 'success') {
    console.log('[payapp] non-success result:', result);
    // 실패/취소는 그냥 OK만 보고 끝낸다.
    return res.status(200).send('OK');
  }

  if (!tid) {
    console.error('[payapp] missing tid');
    return res.status(400).send('MISSING_TID');
  }

  let meta = {};
  try {
    if (typeof var1 === 'string') {
      meta = JSON.parse(var1);
    } else if (var1 && typeof var1 === 'object') {
      meta = var1;
    }
  } catch (e) {
    console.error('[payapp] failed to parse var1', e);
  }

  const packId = meta.packId;
  const pack   = PACKS[packId];
  if (!pack) {
    console.error('[payapp] unknown packId', packId);
    return res.status(400).send('UNKNOWN_PACK');
  }

  const reqPrice = Number(price || meta.priceKRW);
  if (pack.priceKRW && reqPrice !== pack.priceKRW) {
    console.error('[payapp] price mismatch', packId, reqPrice, pack.priceKRW);
    return res.status(400).send('PRICE_MISMATCH');
  }

  const uid = meta.uid || buyerid;
  if (!uid) {
    console.error('[payapp] missing uid');
    return res.status(400).send('MISSING_UID');
  }

  try {
    // 1) 중복 처리 방지 (tid 단위)
    const payRef = db.ref(`payments/payapp/${tid}`);
    const paySnap = await payRef.once('value');
    if (paySnap.exists()) {
      console.log('[payapp] already processed tid', tid);
      return res.status(200).send('OK');
    }

    await payRef.set({
      uid,
      packId,
      priceKRW: pack.priceKRW,
      result,
      createdAt: admin.database.ServerValue.TIMESTAMP
    });

    // 2) userServerMap에서 server/id 찾기
    const mapSnap = await db.ref(`userServerMap/${uid}`).once('value');
    if (!mapSnap.exists()) {
      console.error('[payapp] userServerMap not found for uid', uid);
      return res.status(200).send('OK');
    }
    const mapVal = mapSnap.val() || {};
    const server = mapVal.server;
    const id     = mapVal.id;
    if (!server || !id) {
      console.error('[payapp] invalid userServerMap entry', uid, mapVal);
      return res.status(200).send('OK');
    }

    // 3) 상품 종류별 처리
    if (pack.kind === 'eco') {
      // 이벤트코인 → 우편함 지급
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
            eventCoins: eco
          },
          meta: {
            packId,
            ecoins: eco,
            priceKRW: pack.priceKRW,
            tid,
            src: 'payapp'
          },
          sentAt: now,
          createdAt: now,
          unread: true
        };
        await mailboxRef.child(newKey).set(mail);
        console.log('[payapp] eco mail created', uid, packId, eco);
      }
    } else if (pack.kind === 'perk' && pack.perkType === 'pickaxe') {
      // 곡괭이 영구 패키지 → perks/pickaxe에 저장
      const perkRef = db.ref(`users/${server}/${id}/perks/pickaxe`);
      await perkRef.transaction(cur => {
        const curTier = cur && cur.tier ? Number(cur.tier) : 0;
        // 이미 같은 티어 이상이면 덮어쓰지 않음
        if (pack.perkTier <= curTier) {
          console.log('[payapp] perk tier not upgraded', { uid, curTier, newTier: pack.perkTier });
          return cur;
        }
        return {
          tier: pack.perkTier,
          resourceMult: pack.resourceMult,
          coinMult: pack.coinMult,
          productionMult: pack.productionMult,
          lastPackId: packId,
          updatedAt: Date.now(),
          src: 'payapp'
        };
      });
      console.log('[payapp] perk updated', uid, packId);
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error('[payapp] handler error', err);
    return res.status(500).send('ERROR');
  }
}

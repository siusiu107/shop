export default async function handler(req, res) {
  try {
    // 0) 단순 접속 체크 (브라우저로 열어볼 때)
    if (req.method === 'GET') {
      return res.status(200).send('SUCCESS');
    }

    const p = req.body || {};
    console.log('PAYAPP FEEDBACK BODY:', p);

    // 1) linkval / userid 검증 (디버그 중이면 조금 느슨하게)
    if (!p) return res.status(200).send('SUCCESS');

    if (p.linkval && String(p.linkval) !== LINKVAL) {
      console.log('BAD LINKVAL', p.linkval);
      return res.status(403).send('FORBIDDEN');
    }

    if (p.userid && String(p.userid).toLowerCase() !== 'siustudio') {
      console.log('BAD USERID', p.userid);
      return res.status(400).send('BAD_USER');
    }

    const payStateRaw = String(p.pay_state || p.PAY_STATE || p.state || '');
    const payState = payStateRaw.toLowerCase();
    const approved = (payState === '2' || payState === '승인' || payState === 'success');

    // 2) 승인 전(pay_state=1 등)에는 그냥 SUCCESS만 돌려주고 끝
    if (!approved) {
      return res.status(200).send('SUCCESS');
    }

    // === 여기부터는 "진짜 결제 완료" 상태만 처리 ===
    const price = Number(p.price || p.PCD_PAY_TOTAL || p.amount || 0);
    let meta = {};
    try { meta = JSON.parse(p.var1 || '{}'); } catch {}
    const { uid, packId } = meta;
    const pack = PACKS[packId];
    if (!uid || !pack) return res.status(200).send('BAD_META');
    if (Number(pack.priceKRW) !== price) return res.status(200).send('PRICE_MISMATCH');

    const tid = String(p.tid || p.PCD_PAY_OID || p.PCD_PAY_REQKEY || '');
    if (tid) {
      const dupRef = db.ref(`payments/payapp/${tid}`);
      const dup = await dupRef.get();
      if (dup.exists()) return res.status(200).send('DUP');
      await dupRef.set({ uid, packId, price, at: Date.now() });
    }

    const mapSnap = await db.ref(`userServerMap/${uid}`).get();
    if (!mapSnap.exists()) return res.status(200).send('NO_USER_MAP');
    const { server, id } = mapSnap.val() || {};
    if (!server || !id) return res.status(200).send('BAD_USER_MAP');

    const mailId = `mail_${Date.now()}_${Math.floor(Math.random()*9999)}`;
    const mailData = {
      subject: '이벤트코인 결제 완료',
      body: `${pack.title} 결제가 확인되었습니다!\\n게임 우편함에서 수령해 주세요.`,
      from: 'system@siustudio.kro.kr',
      sentAt: Date.now(),
      rewards: { eventCoins: pack.ecoins }
    };

    await db.ref(`users/${server}/${id}/mailbox/${mailId}`).set(mailData);
    return res.status(200).send('SUCCESS');
  } catch (e) {
    console.error('payapp feedback error', e);
    return res.status(500).send('ERROR');
  }
}

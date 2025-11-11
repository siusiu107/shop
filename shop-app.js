// shop-app.js
const ORIGIN = window.location.origin;
const FEEDBACK_URL = ORIGIN + "/api/pay/feedback";
const RETURN_URL   = ORIGIN + "/thankyou.html";

// 값을 프로젝트에 맞게 교체하세요
const PAYAPP_USERID = "siustudio";   // 판매자 아이디
const SHOP_NAME     = "태양계정복";             // 상점명

const $list = document.getElementById('list');
const $eco  = document.getElementById('eco-balance');
const $ctx  = document.getElementById('ctxline');
const $close= document.getElementById('close-btn');

let parentOrigin = null;     // 메시지를 보낼 부모 오리진
let embedMode = false;       // ?embed=1 일 때 true
let userCtx = null;          // { uid, idToken?, eventCoins, ... }

function parseQuery() {
  const q = new URLSearchParams(location.search);
  embedMode = q.get('embed') === '1';
  if (embedMode) $close.classList.remove('hidden');
}
parseQuery();

function postToParent(payload){
  if (!parentOrigin || !window.parent || window.parent === window) return;
  try { window.parent.postMessage(payload, parentOrigin); } catch {}
}

// 부모에게 준비 완료 알림
function notifyReady() {
  try { window.parent && window.parent.postMessage({ type:'shop-ready' }, '*'); } catch {}
}

function setEco(v){
  $eco.textContent = typeof v === 'number' ? v.toLocaleString() : '-';
}

async function renderProducts(){
  const products = await fetch('/shared/products.json').then(r=>r.json());
  $list.innerHTML = products.map(p => `
    <div class="card">
      <div class="name">${p.name}</div>
      <div class="price">${p.priceKRW.toLocaleString()}원 ${p.bonus?`<span class="mut">(+보너스 ${p.bonus})</span>`:''}</div>
      <button data-id="${p.id}">구매</button>
    </div>
  `).join('');

  $list.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-id]'); if (!btn) return;
    const productId = btn.dataset.id;
    const buyerId = (userCtx && (userCtx.uid || userCtx.email)) || 'guest';

    // 1) 서버에서 주문 준비 (서버 기준으로 price/goodname 확정)
    const init = await fetch('/api/orders/init', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ productId, buyerId })
    }).then(r=>r.json()).catch(()=>null);

    if (!init || !init.ok) { alert('주문 준비 실패'); return; }

    const { orderId, goodname, priceKRW } = init.order;

    // 2) PayApp 결제창 호출
    PayApp.setParam('userid',      PAYAPP_USERID);
    PayApp.setParam('shopname',    SHOP_NAME);
    PayApp.setParam('goodname',    goodname);
    PayApp.setParam('price',       priceKRW);
    PayApp.setParam('buyerid',     buyerId);
    PayApp.setParam('var1',        orderId);   // 주문ID
    PayApp.setParam('var2',        productId); // 상품ID(검증용)
    PayApp.setParam('returnurl',   RETURN_URL);
    PayApp.setParam('feedbackurl', FEEDBACK_URL);
    PayApp.setParam('openpaytype', 'card,naverpay,applepay');

    PayApp.payrequest();
  });
}

window.addEventListener('message', (event) => {
  // 부모(게임)에서 오는 메시지만 처리
  // 최초 메시지를 받은 순간 그 오리진을 parentOrigin으로 고정
  if (!parentOrigin) parentOrigin = event.origin;

  const data = event.data || {};
  if (!data || typeof data !== 'object') return;

  if (data.type === 'shop-context') {
    userCtx = data;
    $ctx.textContent = `유저: ${userCtx.displayName || userCtx.email || userCtx.uid || 'unknown'}`;
    if (typeof userCtx.eventCoins === 'number') setEco(userCtx.eventCoins);
  }
  if (data.type === 'shop-balance') {
    if (typeof data.eventCoins === 'number') setEco(data.eventCoins);
  }
});

$close.addEventListener('click', () => {
  postToParent({ type:'shop-close' });
});

// 초기 렌더 + 준비 알림 + 컨텍스트 요청
renderProducts().then(()=>{
  if (embedMode) {
    notifyReady();
    // 부모에게 컨텍스트 요청
    postToParent({ type:'shop-context-request' });
    // 현재 잔액도 요청
    postToParent({ type:'shop-balance-request' });
  }
});

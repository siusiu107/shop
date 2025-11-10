import { PRODUCTS } from './products.js';

/** 배포 환경에서도 자동 동작하도록 origin 기준으로 URL 설정 */
const ORIGIN = window.location.origin;
const FEEDBACK_URL = ORIGIN + "/api/pay/feedback";
const RETURN_URL   = ORIGIN + "/thankyou.html";

/** 여기를 본인 값으로 수정하세요 (userid는 비밀값이 아니며 JS API에서 사용됨) */
const PAYAPP_USERID = "siustudio";  // 판매자 아이디
const SHOP_NAME     = "SIU Studio";          // 상점명
const BUYER_ID      = "demo-user-123";       // 게임내 유저ID

const $shop = document.getElementById('shop');
$shop.innerHTML = PRODUCTS.map(p => `
  <div class="item">
    <div class="title">${p.name}</div>
    <div class="price">${p.priceKRW.toLocaleString()}원</div>
    <button data-id="${p.id}">구매</button>
  </div>
`).join('');

$shop.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const p = PRODUCTS.find(x => x.id === btn.dataset.id);
  const orderId = crypto.randomUUID();

  PayApp.setParam('userid',     PAYAPP_USERID);
  PayApp.setParam('shopname',   SHOP_NAME);
  PayApp.setParam('goodname',   p.name);
  PayApp.setParam('price',      p.priceKRW);
  PayApp.setParam('buyerid',    BUYER_ID);
  PayApp.setParam('var1',       orderId);
  PayApp.setParam('returnurl',  RETURN_URL);
  PayApp.setParam('feedbackurl',FEEDBACK_URL);
  PayApp.setParam('openpaytype','card,naverpay,applepay');

  PayApp.payrequest();
});

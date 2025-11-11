# SIU Shop (iframe embed) for Vercel

- ?embed=1 모드에서 부모(게임)와 postMessage로 통신합니다.
- 부모는 `shop-ready`를 받으면 `shop-context`/`shop-balance`를 보내주세요.
- 결제는 PayApp JS로 처리하고, 웹훅은 `/api/pay/feedback`으로 받습니다.

## 바꿀 것
- `shop-app.js`의 `PAYAPP_USERID`, `SHOP_NAME`

## 배포
- 깃허브 푸시 → Vercel Import → `https://<shop>.vercel.app`
- 게임에서 `SHOP_BASE_URL`을 해당 도메인으로 설정하세요. (예: `https://<shop>.vercel.app/?embed=1`)

## 엔드포인트
- `POST /api/orders/init` : 주문 준비(서버 기준 goodname/price 확정)
- `POST /api/pay/feedback` : PayApp 웹훅 (최초 통지 SUCCESS, 완료 시 검증 & 코인지급 지점)
- `GET  /api/pay/feedback` : 최근 피드백 로그 확인(임시)

## 파일
- `index.html`, `shop-app.js`, `thankyou.html`
- `shared/products.json`
- `api/orders/init.js`
- `api/pay/feedback.js`
- `admin.html`
- `vercel.json`

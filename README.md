# PayApp × Vercel × GitHub 데모

## 구성
- `index.html`, `products.js`, `vercel-app.js` : 프론트(정적)
- `api/pay/feedback.js` : Vercel Serverless Function (웹훅)
- `thankyou.html` : 결제 후 돌아올 페이지
- `vercel.json` : 런타임 지정

## 배포(깃허브 → 버셀)
1. 깃허브에 새 리포지토리 만들고 이 파일들 커밋/푸시
2. Vercel 대시보드 → **Add New… → Project** → 해당 리포지토리 Import
3. 빌드 설정은 기본(Zero‑Config). 배포 후 도메인: `https://<project>.vercel.app`
4. `vercel-app.js`에서 `PAYAPP_USERID`만 본인 값으로 변경
   - `FEEDBACK_URL`/`RETURN_URL`은 `window.location.origin` 기준으로 자동 설정됨
5. 브라우저에서 `index.html` 열고 결제 테스트

## 주의
- 코인 지급은 **오직 `/api/pay/feedback`**에서만 처리하세요.
- 서버리스는 상태가 유지되지 않을 수 있으니, 운영에선 **DB(예: Firebase/Supabase)** 를 사용하세요.

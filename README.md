# PayApp → Firebase 우편 지급 키트

부모(iframe) 없이, PayApp 결제 **승인 시 게임 우편함에 선물 자동 발송**하는 최소 구성입니다.

## 포함 파일
- `pay/index.html` : 로그인 확인 후 결제 버튼(페이앱 라이트 스크립트 사용)
- `api/payapp/feedback.js` : PayApp 웹훅(서버→서버). 승인되면 `users/{server}/{id}/mailbox/{mailId}`에 우편 생성
- `package.json` : `firebase-admin` 의존성

## 환경변수 (Vercel → Project Settings → Environment Variables)
- `FIREBASE_SERVICE_ACCOUNT` : **Admin SDK 서비스계정 JSON 전체**
- `PAYAPP_LINKVAL` : 페이앱 연동 VALUE (웹훅 검증용)

## 배포
1. 이 폴더를 GitHub에 푸시 → Vercel에 연결
2. 위 환경변수를 설정 후 배포
3. 결제 페이지: `/pay/index.html`
4. 결제 성공 시 PayApp이 `/api/payapp/feedback` 으로 콜백 → 게임 우편 생성
5. 사용자는 `/game.html#mailbox` 로 돌아가 우편함에서 **수령**하여 코인 반영

## 주의
- 상품표(가격↔코인)는 서버에서 **재검증**합니다.
- 서비스계정/링크값은 코드에 하드코딩하지 마세요(반드시 환경변수).


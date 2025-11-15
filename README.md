# PayApp 이벤트코인 스페셜 상점 (loginwithgame 연동 버전)

- 이 프로젝트는 **게임의 loginwithgame 페이지를 이용해 로그인**한 뒤,
- PayApp 결제를 통해 이벤트코인을 구매하고,
- 결제 승인 시 Firebase RTDB의 `users/{server}/{id}/mailbox/{mailId}` 에
  `rewards.eventCoins` 가 포함된 우편을 생성하며,
- 이 페이지에서 바로 "결제가 확인되었습니다!" 토스트 알림을 띄우는 구성을 제공합니다.

## 파일 구성

- `index.html`
  - 디자인 개선된 이벤트코인 상점 UI
  - 이메일/비밀번호, Google 로그인 제거
  - 대신 `https://xn--989a202a4ogwtc69p.siustudio.kro.kr/loginwithgame?redirect=...` 으로 이동하는
    **"게임 계정으로 로그인" 버튼**만 사용
  - 로그인 후에는 `userServerMap/{uid}` → `users/{server}/{id}/mailbox` 를 실시간 구독하여
    새 우편(이벤트코인 보상)이 생기면 토스트 알림 표시
- `api/payapp/feedback.js`
  - PayApp 웹훅 엔드포인트
  - linkval 검증 및 금액/상품 매칭 체크
  - `userServerMap/{uid}`에서 server/id 조회 후, 우편 생성
- `package.json`
  - `firebase-admin` 의존성 정의

## 환경 변수 (Vercel → Project Settings → Environment Variables)

반드시 2개는 설정해야 합니다.

- `FIREBASE_SERVICE_ACCOUNT`
  - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
  - 다운받은 JSON 파일 전체 내용을 값에 붙여넣기
- `PAYAPP_LINKVAL`
  - PayApp 판매자 사이트 → 설정(환경설정) → 연동정보
  - 연동 VALUE 값 그대로 복사해 값에 붙여넣기

설정 후 배포하면,

- `/` : loginwithgame 기반 로그인 + 결제 + 결제완료 알림 UI
- `/api/payapp/feedback` : PayApp 웹훅 엔드포인트

로 사용할 수 있습니다.

## loginwithgame 페이지에 대한 전제

- `index.html` 의 `LOGIN_URL` 은
  `https://xn--989a202a4ogwtc69p.siustudio.kro.kr/loginwithgame` 로 되어 있으며,
- 이 페이지는 같은 Firebase 프로젝트를 사용해 게임 계정으로 로그인한 뒤,
- `?redirect=...` 쿼리 파라미터로 전달된 URL로 다시 리다이렉트해 주는 것을 기대합니다.
- 이 상점 페이지와 loginwithgame 페이지는 **같은 도메인(혹은 동일한 브라우저 환경)** 에서 동작해야
  Firebase Auth 세션이 유지됩니다.

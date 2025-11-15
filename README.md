# PayApp 이벤트코인 결제 (독립 로그인 + Google + 결제완료 알림 버전)

이 zip만 Vercel에 올려도,
- 이 페이지 자체에서 Firebase 이메일/비밀번호 로그인 & 회원가입
- Google 계정으로 로그인
- PayApp 결제
- 결제 승인 시 Firebase RTDB의 `users/{server}/{id}/mailbox/{mailId}`에
  `rewards.eventCoins` 포함 우편 생성
- 그리고 **이 페이지에서 실시간으로 새 우편을 감지하여
  "결제가 확인되었습니다! 이벤트코인 N개" 토스트 알림 표시**

까지 한 번에 동작하도록 만든 최소 구성입니다.

## 포함 파일
- `index.html`
  - Firebase 로그인(이메일/비번 + Google)
  - 로그인 후 이벤트코인 상품 4개 버튼
  - PayApp 결제 시작 코드
  - RTDB의 `userServerMap/{uid}` → `users/{server}/{id}/mailbox` 를 실시간 구독
  - 새로 생성된 우편 중 최근 10분 이내의 것에 대해
    - 이벤트코인 보상이 있으면: "결제가 확인되었습니다! 이벤트코인 N개..." 토스트
    - 그 외 우편이면: "새 우편이 도착했습니다..." 토스트
- `api/payapp/feedback.js`
  - PayApp 웹훅(서버→서버)
  - linkval, 금액/상품 매칭 검증 후
    유저 우편함에 이벤트코인 지급 우편 생성
- `package.json`
  - `firebase-admin` 의존성

## 환경 변수 (Vercel → Project Settings → Environment Variables)

반드시 2개는 설정해야 합니다.

- `FIREBASE_SERVICE_ACCOUNT`
  - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
  - 다운받은 JSON 파일 전체 내용을 값에 붙여넣기
- `PAYAPP_LINKVAL`
  - PayApp 판매자 사이트 → 설정(환경설정) → 연동정보
  - 연동 VALUE 값 그대로 복사해 값에 붙여넣기

설정 후 재배포하면,
- `/` : 로그인(이메일/비번 + Google) + 결제 + 결제완료 토스트 알림 페이지
- `/api/payapp/feedback` : PayApp 웹훅 엔드포인트

로 사용할 수 있습니다.









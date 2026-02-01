# 태양계 정복 – 이벤트코인/곡괭이 결제 상점 (PayApp)

이 프로젝트는 **Firebase Auth로 로그인(이메일/구글)** 한 뒤 PayApp 결제를 진행하고,
PayApp 결제 완료( pay_state=4 ) 웹훅이 오면 **구매자 UID에만** 아래 경로로 즉시 반영합니다.

- 이벤트코인: `android/uid/{uid}/gameData/eventCoins` (숫자 증가, transaction)
- 곡괭이 패키지: `android/uid/{uid}/perks/pickaxe` (더 높은 tier만 반영, transaction)

> 즉, **우편함을 생성하지 않습니다.** (A안)

## 파일 구성

- `index.html`
  - 이벤트코인 상점 UI + 이메일/구글 로그인
  - 로그인 후 `android/uid/{uid}/gameData/eventCoins` 변화를 실시간 구독해서 “반영됨” 토스트 표시
  - 곡괭이 패키지 UI는 `android/uid/{uid}/perks/pickaxe`를 읽어 단계 잠금/해제
- `api/payapp/feedback.js`
  - PayApp 웹훅 엔드포인트
  - linkval 검증, 금액/상품 매칭 체크, mul_no 중복 방지
  - 결제 완료 시 위 DB 경로로 즉시 반영
- `package.json`
  - `firebase-admin` 의존성

## 환경 변수 (Vercel → Project Settings → Environment Variables)

필수 2개:

- `FIREBASE_SERVICE_ACCOUNT`
  - Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
  - 다운받은 JSON 파일 내용을 **그대로** 값에 붙여넣기
- `PAYAPP_LINKVAL`
  - PayApp 판매자 사이트 → 설정(환경설정) → 연동정보의 **연동 VALUE** 값

배포 후:

- `/` : 상점 페이지
- `/api/payapp/feedback` : PayApp 웹훅 엔드포인트

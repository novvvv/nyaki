# iPhone 설치

1. 아이폰을 Mac에 케이블로 연결하고 잠금을 해제한다.
2. **프로젝트 루트**(`nyaki/`)에서 실행한다.

```bash
cd /Users/choedoil/Desktop/nyaki
flutter pub get
cd ios && pod install && cd ..
open ios/Runner.xcworkspace
```

이미 `ios/` 안에 있다면:

```bash
open Runner.xcworkspace
```

또는 Flutter로 바로 설치:

```bash
flutter run --release -d 기기ID
```

3. Xcode 상단에서 연결한 아이폰을 선택한다.
4. `Runner > Signing & Capabilities > Team`에서 본인 계정을 선택한다.
5. Xcode의 실행 버튼(`▶`)을 누른다.

## 실행되지 않을 때

- 아이폰에서 개발자 모드를 켠다: `설정 > 개인정보 보호 및 보안 > 개발자 모드`
- 개발자를 신뢰한다: `설정 > 일반 > VPN 및 기기 관리`
- 무료 Apple 계정으로 설치한 앱은 약 7일마다 다시 설치해야 한다.

## Google 로그인

- `GoogleService-Info.plist` 위치: `ios/Runner/GoogleService-Info.plist`
- Firebase 앱 설정: 프로젝트 개요 → 톱니바퀴 → 프로젝트 설정 → 내 앱
- Authentication: 프로젝트 안 → Authentication → Sign-in method → Google

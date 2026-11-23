import type { Metadata } from "next";

import { ContactLink, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "개인정보처리방침 · Nyaki" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보처리방침"
      intro={
        <p>
          냐키(Nyaki, 이하 &lsquo;서비스&rsquo;)는 단어 학습에 꼭 필요한 정보만
          다루고, 그 밖의 목적으로 쓰지 않습니다. 이 방침은 어떤 정보를 왜
          처리하고 언제 지우는지 알려 드립니다.
        </p>
      }
    >
      <LegalSection title="1. 처리하는 정보">
        <ul>
          <li>
            <strong className="font-medium text-ink">로그인 정보</strong> —
            Google 계정으로 로그인하면 인증 서비스(Google Firebase
            Authentication)가 이름, 이메일 주소, 프로필 사진, 계정 식별값을
            받습니다. 서비스의 서버에는 이 중 계정 식별값만 저장합니다.
          </li>
          <li>
            <strong className="font-medium text-ink">학습 기록</strong> — 직접
            만든 단어장 · 폴더 · 단어 · 빈칸 노트, 복습(채점) 기록, 출석 기록,
            담은 단어 팩 기록.
          </li>
          <li>
            <strong className="font-medium text-ink">자동으로 남는 정보</strong>{" "}
            — 서버와 호스팅 업체가 보안과 장애 대응을 위해 접속 IP, 접속 시각,
            브라우저 정보를 기록할 수 있습니다.
          </li>
          <li>
            <strong className="font-medium text-ink">브라우저 저장소</strong> —
            화면 테마, 사이드바 너비, 테스트 화면 설정처럼 이 기기에서만 쓰는
            설정을 브라우저에 저장합니다. 서버로 보내지 않습니다.
          </li>
        </ul>
        <p>비밀번호는 받지 않으며, 광고 · 분석용 쿠키는 쓰지 않습니다.</p>
      </LegalSection>

      <LegalSection title="2. 처리 목적">
        <ul>
          <li>로그인과 본인 확인</li>
          <li>단어장 저장, 여러 기기 간 동기화, 복습 일정 계산</li>
          <li>서비스 오류 확인과 부정 이용 방지</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 보관 기간과 파기">
        <p>
          정보는 회원 탈퇴 전까지 보관합니다. 마이페이지에서 탈퇴하면 서버에
          저장된 단어장과 학습 기록을 지체 없이 삭제합니다. 법령에 따라 보관해야
          하는 정보가 생기면 그 기간 동안만 따로 보관합니다.
        </p>
      </LegalSection>

      <LegalSection title="4. 제3자 제공">
        <p>
          이용자의 정보를 다른 회사나 개인에게 팔거나 제공하지 않습니다. 법령에
          따라 수사기관 등이 정당하게 요청하는 경우는 예외입니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 처리 위탁과 국외 이전">
        <p>서비스 운영을 위해 아래 업체의 서비스를 이용합니다.</p>
        <ul>
          <li>Google LLC (Firebase Authentication) — 로그인 인증</li>
          <li>Cloudflare, Inc. — 웹사이트 호스팅과 전송</li>
          <li>Amazon Web Services, Inc. — 서버와 데이터베이스 운영</li>
        </ul>
        <p>
          이 업체들은 국외에 서버를 둘 수 있어, 위 정보가 서비스 이용 시점에
          네트워크를 통해 국외로 전송 · 보관될 수 있습니다. 이전을 원하지 않으면
          서비스 이용을 멈추고 탈퇴할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="6. 이용자의 권리">
        <ul>
          <li>
            단어장과 학습 기록은 서비스 안에서 언제든 보고 고치고 지울 수
            있습니다.
          </li>
          <li>
            마이페이지 &rsaquo; 회원 탈퇴로 모든 기록을 한 번에 지울 수
            있습니다.
          </li>
          <li>
            그 밖의 열람 · 정정 · 삭제 · 처리정지 요청은 아래 문의 창구로 보내
            주세요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. 만 14세 미만 아동">
        <p>
          만 14세 미만 아동의 개인정보는 법정대리인의 동의 없이 처리하지
          않습니다. 만 14세 미만이라면 보호자와 함께 이용해 주세요.
        </p>
      </LegalSection>

      <LegalSection title="8. 안전성 확보 조치">
        <p>
          모든 통신은 HTTPS로 암호화하고, 서버 접근 권한을 운영자로 제한합니다.
          각 이용자는 자기 계정의 기록에만 접근할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 개인정보 보호책임자 · 문의">
        <p>
          개인정보 보호책임자: 냐키 운영자
          <br />
          문의: <ContactLink />
        </p>
        <p>
          그 밖의 침해 신고 · 상담은 개인정보침해신고센터(privacy.kisa.or.kr,
          국번 없이 118)에 할 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 방침의 변경">
        <p>
          방침을 바꾸면 시행 7일 전부터 이 페이지에 알립니다. 이용자에게 불리한
          변경은 30일 전부터 알립니다.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

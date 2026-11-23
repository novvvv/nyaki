import type { Metadata } from "next";
import Link from "next/link";

import { ContactLink, LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = { title: "이용약관 · Nyaki" };

export default function TermsPage() {
  return (
    <LegalPage
      title="이용약관"
      intro={
        <p>
          이 약관은 냐키(Nyaki, 이하 &lsquo;서비스&rsquo;)를 이용하는 조건과
          절차, 이용자와 운영자의 권리 · 의무를 정합니다.
        </p>
      }
    >
      <LegalSection title="1. 서비스 내용">
        <p>
          서비스는 단어장 만들기, 간격 반복 복습, 단어 팩 담기 등 외국어 단어
          학습 기능을 무료로 제공합니다. 일부 기능은 준비 중이며, 내용은 운영
          사정에 따라 바뀔 수 있습니다.
        </p>
      </LegalSection>

      <LegalSection title="2. 가입과 계정">
        <ul>
          <li>
            Google 계정으로 로그인하면 이 약관과{" "}
            <Link
              href="/privacy"
              className="text-ink underline decoration-taupe/60 underline-offset-2"
            >
              개인정보처리방침
            </Link>
            에 동의하고 가입한 것으로 봅니다.
          </li>
          <li>계정은 본인만 이용해야 하며, 관리 책임은 이용자에게 있습니다.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. 이용자가 만든 내용">
        <p>
          이용자가 직접 입력한 단어장과 기록은 이용자의 것입니다. 서비스는 이를
          저장 · 동기화 · 복습 계산에만 쓰고 공개하지 않습니다. 다른 사람의
          권리를 침해하는 내용을 올리지 말아 주세요.
        </p>
      </LegalSection>

      <LegalSection title="4. 서비스 콘텐츠">
        <p>
          그림 단어 카드, 캐릭터 그림, 단어 팩 등 서비스가 제공하는 콘텐츠의
          권리는 운영자에게 있습니다. 개인 학습 목적으로 자유롭게 쓸 수 있지만,
          허락 없이 복제 · 배포 · 판매하거나 다른 서비스에 옮겨 쓸 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="5. 금지 행위">
        <ul>
          <li>다른 사람의 계정을 쓰거나 정보를 도용하는 행위</li>
          <li>
            서버에 과도한 부하를 주거나 자동화 수단으로 대량 수집하는 행위
          </li>
          <li>서비스의 보안을 우회하거나 정상 운영을 방해하는 행위</li>
          <li>법령이나 공공질서에 어긋나는 행위</li>
        </ul>
        <p>위 행위가 확인되면 이용을 제한할 수 있습니다.</p>
      </LegalSection>

      <LegalSection title="6. 서비스의 변경 · 중단">
        <p>
          점검, 장애, 운영 사정으로 서비스의 전부 또는 일부를 바꾸거나 멈출 수
          있습니다. 미리 알릴 수 있는 경우에는 서비스 안에서 공지합니다.
          서비스를 종료할 때는 30일 전에 알리고, 그동안 이용자가 기록을 정리할
          수 있게 합니다.
        </p>
      </LegalSection>

      <LegalSection title="7. 탈퇴">
        <p>
          이용자는 언제든 마이페이지 &rsaquo; 회원 탈퇴로 탈퇴할 수 있습니다.
          탈퇴하면 서버의 단어장과 학습 기록이 삭제되며 되돌릴 수 없습니다.
        </p>
      </LegalSection>

      <LegalSection title="8. 책임의 한계">
        <p>
          서비스는 무료로 제공되며, 운영자의 고의 또는 중대한 과실이 없는 한
          서비스 이용으로 생긴 손해에 책임을 지지 않습니다. 천재지변, 통신 장애
          등 운영자가 통제할 수 없는 사유로 생긴 문제도 같습니다.
        </p>
      </LegalSection>

      <LegalSection title="9. 약관의 변경">
        <p>
          약관을 바꾸면 시행 7일 전부터 이 페이지에 알립니다. 이용자에게 불리한
          변경은 30일 전부터 알립니다. 바뀐 약관에 동의하지 않으면 탈퇴할 수
          있습니다.
        </p>
      </LegalSection>

      <LegalSection title="10. 문의 · 준거법">
        <p>
          문의: <ContactLink />
        </p>
        <p>이 약관은 대한민국 법률을 따릅니다.</p>
      </LegalSection>
    </LegalPage>
  );
}

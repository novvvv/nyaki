# Nyaki Design Tokens

> 웹·앱 공통 컬러 팔레트. Flutter는 `lib/core/theme/nyaki_colors.dart`,  
> 웹은 `web/src/app/globals.css`와 동기화한다.

## Palette (2026-08-26 확정 — 4색 고정)

이 4가지 색상만 사용한다. 다른 색상 추가 금지.

| Name | HEX | RGB | Role |
|------|-----|-----|------|
| **Off white** | `#FDFCF8` | 253, 252, 248 | 가장 밝은 표면 (카드, 떠있는 요소) |
| **Ivory** | `#F3F0E9` | 243, 240, 233 | 기본 배경 (스캐폴드, 페이지) |
| **Nude** | `#E3DBCC` | 227, 219, 204 | 테두리, 구분선, 비활성/보조 표면 |
| **Obsidian** | `#101010` | 16, 16, 16 | 텍스트, 필 버튼, 강조 |

## Semantic mapping

| Token | Color | Usage |
|-------|-------|--------|
| `offWhite` | Off white | 카드/시트 배경, 떠있는 요소의 표면 |
| `ivory` | Ivory | 스캐폴드/페이지 기본 배경 |
| `nude` | Nude | 테두리, 체크 링, 구분선, 비활성 상태 |
| `obsidian` | Obsidian | 본문 텍스트, 헤딩, 선택된 필 버튼, 강조 |

## Principles

- 색상은 이 4개로 고정. 별도의 액센트 컬러(예: 기존 Umber 계열 웜톤)는 쓰지 않는다 — 강조가 필요하면 Obsidian 채움으로 처리.
- 순수 흰색(`#FFFFFF`)·순수 검정(`#000000`) 풀블리드 배경 금지 — Off white / Obsidian으로 대체.
- 선택/주요 액션은 Obsidian 채움 + Off white(또는 Ivory) 텍스트.
- 대비는 Obsidian on Ivory/Off white 기준으로 확보하고, Nude 위에 장문 본문 텍스트는 지양.
- Nude는 hover/칩/구분선용으로, elevation은 얕게(그림자 무겁지 않게) 유지.

## ⚠️ 코드 미동기화 상태

이 문서는 2026-08-26에 4색으로 새로 고정됐지만, 아래 구현체는 **아직 예전 5색 팔레트(Umber/Vanilla/Black/Soft Dune/Classic Taupe) 그대로**라 이 문서와 어긋나 있다. 코드 반영은 별도 작업으로 진행할 것.

- `lib/core/theme/nyaki_colors.dart`
- `web/src/app/globals.css`

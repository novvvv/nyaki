# Nyaki Design Tokens

> 웹·앱 공통 컬러 팔레트. Flutter는 `lib/core/theme/nyaki_colors.dart`,  
> 웹은 `web/src/app/globals.css`와 동기화한다.

## Palette

| Name | HEX | RGB | Role |
|------|-----|-----|------|
| **Umber** | `#443A35` | 68, 58, 53 | Warm dark accent / secondary text |
| **Vanilla** | `#F8F4EE` | 248, 244, 238 | App & web background (`cream`) |
| **Black** | `#252525` | 37, 37, 37 | Primary text / filled controls (`ink`) |
| **Soft Dune** | `#E4DDCC` | 228, 221, 204 | Subtle surfaces, dividers (`muted` / `subtle`) |
| **Classic Taupe** | `#C5B49D` | 197, 180, 157 | Borders, chips, unselected strokes |

## Semantic mapping

| Token | Color | Usage |
|-------|-------|--------|
| `cream` / `--nyaki-cream` | Vanilla | Scaffold, page background |
| `ink` / `--nyaki-ink` | Black | Headings, primary buttons |
| `umber` / `--nyaki-umber` | Umber | Secondary emphasis, warm dark UI |
| `softDune` / `--nyaki-subtle` | Soft Dune | Cards, chips bg, soft dividers |
| `taupe` / `--nyaki-taupe` | Classic Taupe | Borders, check rings, progress |

## Principles

- Avoid pure white (`#FFFFFF`) full-bleed backgrounds; use Vanilla.
- Prefer Taupe borders over heavy black outlines at rest.
- Selected / primary actions use Black fill + Vanilla text.
- Keep contrast readable: Black on Vanilla, not Umber on Soft Dune for long body copy.
- Soft Dune for hover / chip surfaces; keep elevation subtle (no heavy shadows).

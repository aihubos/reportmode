# ChatGPT Pricing Report Design

## 1. Atmosphere

Hermes Second Brain 보고서와 같은 밝고 신뢰감 있는 임원 설명 자료다. 흰 종이 위에 선명한 블루를 핵심 행동과 숫자에만 쓰고, 라임 하이라이트는 한 문장 판단에만 쓴다. 정보가 많아도 답답하지 않도록 큰 여백, 라운드 카드, 명확한 표 계층을 유지한다.

## 2. Color

| Token | Value | Role |
| --- | --- | --- |
| `--blue` | `#3182f6` | Primary action and emphasis |
| `--blue-strong` | `#1b64da` | Active and heading emphasis |
| `--blue-soft` | `#e8f3ff` | Soft surfaces |
| `--ink` | `#191f28` | Primary text |
| `--ink-2` | `#333d4b` | Secondary heading text |
| `--muted` | `#6b7684` | Supporting text |
| `--muted-2` | `#8b95a1` | Low-emphasis metadata |
| `--line` | `#e5e8eb` | Borders |
| `--surface` | `#f7f8fa` | Page and neutral cards |
| `--surface-2` | `#f2f4f6` | Segmented controls and neutral emphasis |
| `--white` | `#ffffff` | Main paper |
| `--lime` | `#dfff6a` | Single highlighted conclusion |
| `--mint` | `#dffbf2` | Positive cost signal |
| `--warning` | `#fff5cf` | Cost-change caution |
| `--danger` | `#fff0f0` | Reserved status surface |

All foreground/background pairs use dark text on white or surface backgrounds, or white text on `--blue-strong`.

## 3. Typography

- System Korean stack: `-apple-system, BlinkMacSystemFont, Apple SD Gothic Neo, Pretendard, Noto Sans KR, Segoe UI, sans-serif`.
- Display: clamp(44px, 6vw, 76px), 850, 1.08, -0.065em.
- Section title: clamp(34px, 4.7vw, 56px), 850, 1.17, -0.055em.
- Body: 17px, 600, 1.65, -0.025em.
- Table: 14px, 650, 1.5.

## 4. Spacing

Reference-fidelity base unit is 1px. The page rhythm uses named variables at 8px, 12px, 16px, 20px, 24px, 28px, 32px, 40px, 56px, and 80px. Optical values below 16px are limited to compact navigation, labels, and table cells.

## 5. Components

- Floating navigation: white translucent surface, `--radius-5`, subtle border and small shadow.
- Primary button: `--blue`, white type; hover lifts by 2px.
- Secondary button: `--surface`, `--ink-2`; hover deepens to a neutral surface.
- Cards: white, `--radius-6`, `--line` border, restrained `--shadow-sm`.
- Tables: `--radius-4` wrapper with horizontal scroll below tablet width; column header uses `--blue-soft`.
- Active view control: white selected segment inside neutral track.

## 6. Motion

Only opacity and transform transition, 180-240ms ease-out. A scroll reveal is optional and disabled by `prefers-reduced-motion`.

## 7. Depth

Use border-first depth with two restrained shadows: `--shadow-sm` for cards and `--shadow-md` only for the hero pricing map. No glass cards outside the floating navigation.

## Do / Don't

- Do keep the page light, blue-led, and information dense.
- Do keep all seven comparison tables readable at 390px through horizontal scrolling.
- Do not introduce purple gradients, dark hero sections, em dashes, or unrelated product imagery.

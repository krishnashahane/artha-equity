# Artha desktop design system

The supplied dark terminal reference crowded many facts into one screen. The new direction follows the user's preference for Apple's spacious visual restraint while keeping Artha's own identity and financial workflows. No Apple logos, assets or product copy are used.

## Foundations

| Token | Choice |
|---|---|
| Canvas | Silver `#f5f5f7` |
| Surface | White `#ffffff` |
| Primary text | Ink `#1d1d1f` |
| Secondary text | Grey; functional small copy uses `#737379` |
| Action | Blue `#0071e3` |
| Typeface | Native system sans-serif, with tabular figures for data |
| Workspace | Desktop and tablet minimum width 768px |
| Spacing | Predominantly 8px steps, broad section gaps and generous content padding |

Large editorial headings establish hierarchy. One primary chart or financial result leads each view. Thin separators, quiet surfaces and a restrained palette replace the former terminal density. Source-backed facts are not decorative UI placeholders.

## Information hierarchy

Only Company, Valuation and Research appear in the primary navigation. Sources, model checks, methodology and saved scenarios are utility dialogs. Statement detail, FCFF, sensitivity, bridge and additional peer multiples use disclosures. This preserves depth while reducing the initial reading load.

A model value is labelled as a provisional scenario result. Reported facts, assumptions, unavailable prices and retrospective dates stay distinguishable. Unsupported market fields display an em dash; they never become fabricated values.

## Desktop behavior

The layout adapts from desktop to 768px tablets. Wide financial tables scroll within their sections. No phone navigation or phone layout is supplied. A large-screen enhancement adds breathing room above 1600px. Print styles produce an A4 research document rather than the interactive controls.

## Interaction

Controls have text labels, visible keyboard focus and meaningful states. Dialogs contain focus and close with Escape. Search has a keyboard shortcut, and a skip link bypasses navigation. Reduced-motion preferences are respected. These implemented provisions do not constitute a formal accessibility certification.

## Appearance and accessibility (v1.4)

Semantic CSS custom properties cover both appearances. System preference selects
the default; Theme overrides it and persists locally. Primary/secondary text,
control borders and keyboard focus tokens meet AA contrast against their surfaces.
Dialogs make the app inert, contain Tab/Shift+Tab, support Escape, restore focus
and keep long content scrollable. Loading and study results use polite status
regions. The waterfall is an inline SVG with title/description plus an exact table;
Python supplies its signed steps. Histogram bins also have a data table. Motion
respects prefers-reduced-motion. Responsive support begins at 768px.

Automated keyboard, layout and contrast checks cover the supplied workflows;
a complete WCAG 2.2 AA conformance audit still requires assistive-technology and
manual review. Do not represent these checks as certification.

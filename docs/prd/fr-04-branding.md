# FR-4: AppyDave Branding

**Status:** Implemented
**Added:** 2025-12-18
**Implemented:** 2025-12-19

---

## User Story

As a user, I want FliDeck to follow AppyDave branding guidelines so that presentations and the app frame have a consistent, professional look.

## Problem

FliDeck currently uses default/generic styling. Need to apply AppyDave brand colors, typography, and design patterns to both the application frame and sample presentations.

## Research Sources

**Structured Data (primary):**
- `/ad/brains/brand-dave/data-systems/collections/appydave-brand-identity/current.json`
  - Color palette with hex values and usage rules
  - Contrast pairings (text colors per background)
  - Typography specs (BebasNeue, Oswald, Roboto)
  - Tailwind config ready to copy
  - Usage patterns (Hero, Content Card, Dark Section, CTA Button)
  - Layout specs (spacing, border-radius)

**Visual Reference:**
- `/ad/brains/brand-dave/presentation-assets/color-exploration/index.html`
  - Master color palette with swatches
  - Typography examples using brand fonts
  - Interactive color combinations

**Original Guidelines:**
- `/ad/appydave-brand/design-system/brand-guide.md`
- `/ad/appydave-brand/design-system/visual-design-system.md`

## Scope

Apply branding to:
1. **Sample presentations** - Template slides with AppyDave styling
2. **FliDeck frame** - App chrome, navigation, controls

## Rough Notes

- Review both branding sources for color palettes, typography, design patterns
- Extract relevant style variables (colors, fonts, spacing)
- Apply to FliDeck UI components
- Create branded sample presentation templates

## Acceptance Criteria

_To be refined after research_

- [ ] Brand colors applied to FliDeck frame
- [ ] Typography follows AppyDave guidelines
- [ ] Sample presentation uses brand styling
- [ ] Consistent look across app and content

## Technical Notes

_To be refined_

## Completion Notes

**What was done:**
- Added Google Fonts (Bebas Neue, Oswald, Roboto) to index.html
- Created brand color CSS variables in index.css with semantic mappings
- Implemented AppyDave two-tone logo ("Appy" gold, "Dave" yellow) in Header
- Applied brand typography: BebasNeue for h1/buttons, Oswald for h2-h6 (uppercase), Roboto for body
- Updated all components with brand color scheme:
  - Background: Brand Brown (#342d2d)
  - Surface: Lighter brown (#3d3535)
  - Accent text: Brand Gold (#ccba9d)
  - CTA buttons: Brand Yellow (#ffde59) with dark brown text
  - Interactive elements: Tech Blue (#2E91FC) for links/paths
  - Selected states: Brand Yellow background with dark text
- Implemented consistent hover states using brightness filter
- Added 200ms transition animations per brand guidelines

**Files changed:**
- `client/index.html` (modified - added Google Fonts)
- `client/src/index.css` (modified - brand colors and typography)
- `client/src/components/layout/Header.tsx` (modified - branded logo)
- `client/src/components/layout/Sidebar.tsx` (modified - brand styling)
- `client/src/components/ui/EmptyState.tsx` (modified - brand styling)
- `client/src/components/ui/LoadingSpinner.tsx` (modified - brand styling)
- `client/src/pages/HomePage.tsx` (modified - brand styling)
- `client/src/pages/ConfigPage.tsx` (modified - brand styling)

**Testing notes:**
1. Run `npm run dev` to start client and server
2. Verify header shows "AppyDave FliDeck" with two-tone logo
3. Check presentation cards have brand colors and yellow hover border
4. Navigate to Config page - verify section headers use Oswald uppercase
5. Test "Apply" button uses yellow CTA styling
6. Check loading spinner uses yellow accent color

**Status:** Complete

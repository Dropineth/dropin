# R3 English visual review

Review completed: 2026-09-30T10:09:43.107Z. Classification: **agent_visual / development**.

This review covers all 11 English routes at 375 px and 1440 px. It is a Codex agent visual inspection, not independent human approval, real-phone testing, compiled production acceptance, CI acceptance or deployment evidence. The base was http://127.0.0.1:3101, a development server using dirty R3 source over Git baseline `7613ee6b2b7e32560b49ecb5947b18aa5dc25b71`. That baseline does not identify all source bytes rendered during the review; no immutable production artifact was tested.

**Outcome:** one concrete visual defect was found in the initial screenshots: the English generic-placeholder caption was clipped on all three 375 px scene detail pages. The source owner corrected the viewer sizing. Fresh development screenshots of 33, 29 and 31 were individually inspected and show the complete caption wrapping onto two lines. No further visual blocker was identified within the inspected states. This is a bounded visual observation, not a general accessibility or functional pass.

## Method and coverage

The 22 original full-page images were split without resizing into 1500 px-high strips. Mobile strips were placed side by side, at their original 375 px width, in reading order from left to right. Desktop strips retain their original 1440 px width. All **47 derivative inspection images** were actually opened with view_image at original detail, covering each page from navigation through footer. Gray padding at the end of mobile contact sheets is inspection padding, not page content. The reviewer did not infer readable body copy from height-reduced whole-page thumbnails.

An additional **20 real development viewport images**, each 900 px high, were captured and actually opened. They show floor-plan interactions, form regions and the corrected scene caption. The browser reported `154.0.8037.58`; these are desktop Chrome viewports, with touch capability emulated in the first mobile capture, not physical iOS/Android devices. Supplemental capture ran from 2026-09-30T10:05:56.939Z through 2026-09-30T10:07:35.736Z. Requests were restricted to loopback GET/HEAD; recorded unexpected external requests or writes: 0. No external scene link was followed, no lead was submitted, and no style, image loading attribute or source content was changed for a screenshot.

The first supplemental capture stopped before producing an image because an overly broad status locator matched both the zoom output and room-selection text. The selector was corrected. Some first viewport captures aligned content under the existing sticky navigation; six additional natural-scroll captures use a header-height offset so the selected room, explanatory text, form notice, consent and scene caption can be read unobscured. Earlier captures remain retained. This capture alignment is distinct from the original horizontal viewer-caption defect.

| Route | Observed scope and result at 375 / 1440 |
|---|---|
| /en/life | Header, primary CTA, 33/29 cards, four service directions, floor-plan area, collaboration CTA and footer read through at both widths. Four-room total 671.26 m² and second-floor subtotal 612.57 m² are labeled as planned. |
| /en/life/spaces | 33/29 remain the primary cards; Scene 31 has a separate historical-reference link. Disabled embedding and placeholder notices are visible. Cards and final CTA fit the mobile column. |
| /en/life/spaces/33 | Source, required permissions, HTTP warning, all pending metadata, feedback route and footer inspected. Original 375 px placeholder caption was clipped; fixed development view rechecked. |
| /en/life/spaces/29 | Same complete provenance and disabled-source review as Scene 33, retaining its own /29 HTTP source. Original caption defect and fixed development view both inspected. |
| /en/life/spaces/31 | Historical-reference status, statement that this is not Scene 33, primary-scenes return link and distinct /31 source are readable. Original caption defect and fixed development view both inspected. |
| /en/life/center | Area summary, source plan, four room cards, proposed uses, opening conditions, location context, CTA and footer inspected. Supplemental real UI selection of 2F/L201, 300% focus and opened text alternative checked at both widths. |
| /en/life/agents | Service cards, authorization stages, disabled capability boundary, complete inquiry form and footer inspected. No visible operational agent or robotics claim was inferred from the page. |
| /en/life/membership | CNY 299/599/1000 annual proposals, not-on-sale notice, non-additive pricing statement, interest CTA, collapsed FAQ headings and footer inspected. FAQ answers were not expanded in this review. |
| /en/life/partners | All six collaboration cards and their scope/input/acceptance text, inquiry boundary, field labels, consent, draft action and footer inspected. Supplemental form notice and consent/action viewports were reviewed. No form was submitted. |
| /en/life/trust | Three distinct evidence uses, separate permissions, record-review cards, export/deletion/withdrawal boundaries, withdrawal CTA and footer inspected. Narrow two-column permission cards remain readable. |
| /en/company | Both business entry cards, role-separation notice, contact route, inquiry fields/consent/draft action and footer inspected. Company naming on the page is not corporate-registry verification. |

## Defect and development recheck

- **EN-VIS-01, resolved in development:** On initial 375 px screenshots for /en/life/spaces/33, /29 and /31, “Generic spatial placeholder · not a scene capture” ran beyond the visible card edge. The full source/provenance body was readable, but the placeholder disclaimer itself was incomplete. The issue was reported before any source change by this reviewer.
- The source owner traced the defect to the stage aspect ratio/minimum height transferring an unwanted minimum width. The fresh reviewed images `live-375-scene-{33,29,31}-caption-fixed.jpg` and `live-375-scene-33-fixed-offset.jpg` show the corrected, fully readable caption. Source-owner implementation details are context; the visible recheck is the evidence here. Compiled production and the eventual CI candidate still require their own run.
- Floor-plan room selection visibly updates to L201, 2F, 290.78 m² and the green marker 4; “Focus selected” shows 300% and a corresponding enlarged view. The original plan is necessarily too dense to read every architectural label at 375 px overview scale. Zoom and the opened text alternative provide a usable visual aid in the inspected states. This does not validate drawing measurements, lease boundaries, spatial navigation or real-world access.

## Limits

- No independent human review, screen-reader evaluation, real-device test, production build, Worker runtime or cross-engine acceptance was performed in this subtask. Native browser/OS 200% zoom was not reviewed here.
- Only 375 px and 1440 px English screenshots are claimed reviewed here; 390/768/1920 and Chinese/root ecology are outside this report.
- The default page states and listed supplementary interactions were inspected. Membership FAQ answer states, all room/pan permutations, form submission/receipt states and real scenes were not exhaustively reviewed.
- Real scenes stay disabled; placeholder and metadata inspection does not establish provider rendering, readiness, rights or source availability.
- Visual reading of stated areas and prices does not establish factual, legal, business or financial validity. The displayed planning, pending and not-on-sale qualifications remain visible.
- The Next development indicator appears in these images. It is part of this development capture, not evidence of the production UI.
- Original screenshots were captured before the caption fix. Their source identity is preserved below; only the named fresh scene images establish the development recheck. Other concurrent source changes are not retroactively covered.

## Original screenshot identity

Paths are relative to dropin-earth. All images below were reviewed through the unscaled derivative files listed in the following section.

| Original file | Pixels | Captured UTC (capture manifest) | SHA-256 |
|---|---:|---|---|
| `reports/lifepp-validation/r3-development-visual/375-_en_life-full.jpg` | 375×10244 | 2026-09-30T09:58:53.338Z | `5c65fe69d36cf5da24ae5d0c0b03d378c2d93319fd65b0c3247a4b794870d3bc` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_spaces-full.jpg` | 375×5104 | 2026-09-30T09:58:54.187Z | `c4d7735de7a1cf826354d9d1c827962f38093c57524733871ff39bc43066e0b5` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_spaces_33-full.jpg` | 375×4274 | 2026-09-30T09:58:55.055Z | `d58fdf63ae11b0f08b7311527f2986f460ba220957f4f74bb943fbff1050208d` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_spaces_29-full.jpg` | 375×4274 | 2026-09-30T09:58:55.922Z | `5d41aed6e91b7aeb5c1cf4e97f89c3c7434d919d2a3aa286a84adae51c579ec9` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_spaces_31-full.jpg` | 375×4396 | 2026-09-30T09:58:56.789Z | `283b72220f1260e8a8b100992bc494397b0cbb68a08e488c01575f1359d399fb` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_center-full.jpg` | 375×8453 | 2026-09-30T09:58:57.771Z | `59d4f80167c9d94ffb940337b3fc929c664bee7e998bed59295a7906ce38daea` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_agents-full.jpg` | 375×5708 | 2026-09-30T09:58:58.889Z | `8bbab415bf16b00ae8987e461474fd9bafe83f506b1ea64552f8606a28553444` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_membership-full.jpg` | 375×4540 | 2026-09-30T09:58:59.737Z | `378bb6c2114bc8730b12512259e8e33fb1182a2a39adabebaf8992374644fce8` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_partners-full.jpg` | 375×8079 | 2026-09-30T09:59:00.837Z | `232846368463d00bed784a21d5b2ae9447588efc8422601aa0332d18297a8bfa` |
| `reports/lifepp-validation/r3-development-visual/375-_en_life_trust-full.jpg` | 375×7256 | 2026-09-30T09:59:01.705Z | `3a3e497e2a47a9df3af1303c6e94a458a036ad9ddc3de4a3b8621424da764fca` |
| `reports/lifepp-validation/r3-development-visual/375-_en_company-full.jpg` | 375×4880 | 2026-09-30T09:59:02.889Z | `9ea2335b4233a53cf487b881ef6e187b4e9901f486f0f06c2847be69f8d5fa7e` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life-full.jpg` | 1440×5407 | 2026-09-30T10:00:00.261Z | `e93b29375a128759083ddf00feaa272746b6a7580f232826105e56b98afcaaf1` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_spaces-full.jpg` | 1440×2715 | 2026-09-30T10:00:01.128Z | `d2070f2aee74ac4b007eb0b1d37ffbd741a0535cb5a7cd2d9174d10463ce7871` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_spaces_33-full.jpg` | 1440×3341 | 2026-09-30T10:00:02.013Z | `1285578b592d9ac074006a5b417fce7008fa676acb957e262681925bd92fd805` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_spaces_29-full.jpg` | 1440×3341 | 2026-09-30T10:00:02.877Z | `c34bcfb5422a5a11413a59cf6db3fce256448fc116898e2277cff5fea4708599` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_spaces_31-full.jpg` | 1440×3409 | 2026-09-30T10:00:03.761Z | `f15a7281758a7f1587ebe563e80e74f1bdb8872c169f8bd64471dd85547cbc83` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_center-full.jpg` | 1440×4809 | 2026-09-30T10:00:04.747Z | `2cc15083c0b5cbe828e65e36ebf84d2ffade55ee2561c0e40bf5c1678e568572` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_agents-full.jpg` | 1440×3101 | 2026-09-30T10:00:05.913Z | `a97d65e60fd4ae6dec60a9e85d915dcb492e44a5a95f58a1faaff70cb9f60bb0` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_membership-full.jpg` | 1440×2519 | 2026-09-30T10:00:06.780Z | `b5ed273a936813a52daadfd9d15e8ca8a98455395b87889a023276c3ff49b29b` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_partners-full.jpg` | 1440×3951 | 2026-09-30T10:00:07.896Z | `dbfa5ee9897a333bdb3f04236692ef87af3858132e7e755ec280c213f7326136` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_life_trust-full.jpg` | 1440×3877 | 2026-09-30T10:00:08.781Z | `e8a27e738eb0478f27e68e5fd7d182f7b8747978ff100d3c368f89ab146806a9` |
| `reports/lifepp-validation/r3-development-visual/1440-_en_company-full.jpg` | 1440×2630 | 2026-09-30T10:00:09.845Z | `d6a09eb1c3825922750b716eaac87d07fe305161195b60979fd6a86ed9f95f70` |

All 22/22 original files still matched their recorded hash when this report was written. Original-path contents must not be assumed immutable after this timestamp.

## Files actually opened for inspection

All paths in this list are under `reports/lifepp-validation/r3-development-visual/agent-visual-en/`. Each line names one actual inspected file. Original-width strips cover the complete original page, with no skipped page region.

```text
375-_en_life-full-sections-1.jpg
375-_en_life-full-sections-2.jpg
375-_en_life_spaces-full-sections-1.jpg
375-_en_life_spaces_33-full-sections-1.jpg
375-_en_life_spaces_29-full-sections-1.jpg
375-_en_life_spaces_31-full-sections-1.jpg
375-_en_life_center-full-sections-1.jpg
375-_en_life_center-full-sections-2.jpg
375-_en_life_agents-full-sections-1.jpg
375-_en_life_membership-full-sections-1.jpg
375-_en_life_partners-full-sections-1.jpg
375-_en_life_partners-full-sections-2.jpg
375-_en_life_trust-full-sections-1.jpg
375-_en_life_trust-full-sections-2.jpg
375-_en_company-full-sections-1.jpg
1440-_en_life-full-section-1.jpg
1440-_en_life-full-section-2.jpg
1440-_en_life-full-section-3.jpg
1440-_en_life-full-section-4.jpg
1440-_en_life_spaces-full-section-1.jpg
1440-_en_life_spaces-full-section-2.jpg
1440-_en_life_spaces_33-full-section-1.jpg
1440-_en_life_spaces_33-full-section-2.jpg
1440-_en_life_spaces_33-full-section-3.jpg
1440-_en_life_spaces_29-full-section-1.jpg
1440-_en_life_spaces_29-full-section-2.jpg
1440-_en_life_spaces_29-full-section-3.jpg
1440-_en_life_spaces_31-full-section-1.jpg
1440-_en_life_spaces_31-full-section-2.jpg
1440-_en_life_spaces_31-full-section-3.jpg
1440-_en_life_center-full-section-1.jpg
1440-_en_life_center-full-section-2.jpg
1440-_en_life_center-full-section-3.jpg
1440-_en_life_center-full-section-4.jpg
1440-_en_life_agents-full-section-1.jpg
1440-_en_life_agents-full-section-2.jpg
1440-_en_life_agents-full-section-3.jpg
1440-_en_life_membership-full-section-1.jpg
1440-_en_life_membership-full-section-2.jpg
1440-_en_life_partners-full-section-1.jpg
1440-_en_life_partners-full-section-2.jpg
1440-_en_life_partners-full-section-3.jpg
1440-_en_life_trust-full-section-1.jpg
1440-_en_life_trust-full-section-2.jpg
1440-_en_life_trust-full-section-3.jpg
1440-_en_company-full-section-1.jpg
1440-_en_company-full-section-2.jpg
live-375-center-2f-l201.jpg
live-375-center-2f-focus.jpg
live-375-center-selected-room.jpg
live-375-center-text-alternative.jpg
live-375-partners-fields.jpg
live-375-partners-consent-actions.jpg
live-375-scene-33-caption-fixed.jpg
live-375-scene-29-caption-fixed.jpg
live-375-scene-31-caption-fixed.jpg
live-1440-center-2f-l201.jpg
live-1440-center-2f-focus.jpg
live-1440-center-text-alternative.jpg
live-1440-partners-fields.jpg
live-1440-partners-consent-actions.jpg
live-375-selected-room-offset.jpg
live-375-text-alternative-offset.jpg
live-375-partners-notice-offset.jpg
live-375-partners-consent-offset.jpg
live-375-scene-33-fixed-offset.jpg
live-1440-text-alternative-offset.jpg
```

The ignored `inspection-index.json` records the 22 source hashes, dimensions, 47 derivative filenames/hashes and agent-review flags. The ignored `live-observations.json` records the 20 supplementary screenshot timestamps/hashes, viewport and scoped capture observations. These artifacts support this development-only report; none replaces final candidate CI or release evidence.

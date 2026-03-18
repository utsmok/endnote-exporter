# Style and Pattern Research — `web-ui-ux-refresh`

## Scope

This report documents the current styling system in `web/src/styles.css`, the design patterns currently expressed by the browser-local UI, and the external mood-cue baseline requested by the task.

## External baseline review

### `https://samuelmok.cc/`

The requested source site was reviewed through fetched page content and direct browser inspection.

Observed signals:

1. The landing page uses a very small set of focal choices: strong central emblematic composition, sparse copy, dark atmospheric backdrop, and a high-contrast display serif attribution (`Playfair Display` is explicitly referenced in the footer metadata).
2. The site uses unusual radial navigation and novelty-first SVG interaction. The task request explicitly excludes these patterns from adoption.
3. The site communicates identity through restraint, hierarchy, and typographic personality rather than through broad color semantics.

Observed linked surfaces:

- `https://libraet.samuelmok.cc/` and `https://libraet.samuelmok.cc/list` expose a more conventional content site and database listing. These are useful for message framing and audience context, but the requested mood cues remain more closely associated with the parent landing page than with the linked DeepThought/Zola content theme.
- `https://libraet.samuelmok.cc/posts/endnote-export/` provides relevant trust/capability messaging: domain expertise, migration pain points, date preservation, attachment handling, and conservative user guidance.

The external review supports the user-provided baseline: borrow hierarchy, serif character, and restrained accent confidence; do not borrow radial navigation, rotated labels, or novelty interaction.

## Findings from the current codebase

### 1. The current app already uses a dark theme, but it is generic dark-glass rather than editorial utility

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:1-31` | The root token set establishes dark slate/navy colors with teal/cyan accents. |
| `web/src/styles.css:28-31`, `70-73`, `89` | The page background relies on multi-layer radial gradients for atmospheric treatment. |
| `web/src/styles.css:120-128` | `.card` uses semi-transparent layers plus `backdrop-filter: blur(14px)`. |
| `web/src/styles.css:143-151` | `.hero__glow` adds a diffuse accent glow effect. |

This is directionally compatible with a dark utility product, but visually it reads as generic modern dark-glass rather than precise editorial desktop utility.

### 2. Typography is functionally competent but lacks the requested display personality

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:2` | Only `Inter`-style sans typography is configured through `--font-sans`. |
| `web/src/styles.css:172-181` | `h1` uses scale and weight for hierarchy but no display serif treatment. |
| `web/index.html:4-27` | No external font preload or font-face declaration exists. |

The current hierarchy depends on scale, gradients, and rounded cards rather than a display-font contrast system. The requested direction calls for `Playfair Display` or `Newsreader` in display moments only, with `Inter` retained for operational UI.

### 3. Current tokens are visual, not semantic

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:1-31`, `44-74` | Tokens exist for backgrounds, text, accent, success, warning, danger, borders, and shadows. |
| `web/src/styles.css:194-230`, `603-617`, `662-707` | These tokens are applied as generic surface styling rather than as a severity or workflow system. |

The current token model is adequate for recoloring. It is not yet sufficient for a formal severity taxonomy or for consistent desktop review states without additional semantic layering.

### 4. Surface language is too soft for the requested direction

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:120-128` | Large-radius, blurred cards dominate the UI. |
| `web/src/styles.css:370-389` | Upload surface uses dashed border plus soft gradient fill. |
| `web/src/styles.css:710-724` | Modal container also uses softened glass-like elevation. |

The requested baseline explicitly calls for reduced blur/glass and increased precision, contrast, and crisp layering. The current surface system should therefore be treated as a target for replacement, not preservation.

### 5. Color direction is close, but overly broad in application

| Evidence | Technical finding |
|---|---|
| `web/src/styles.css:13-18` | Teal/cyan primary accents already exist and are compatible with the requested primary action direction. |
| `web/src/styles.css:19-24` | Success/warning/danger colors are present, but the visual language treats them similarly to general accent surfaces. |
| `web/src/styles.css:382-389`, `558-579`, `645-688` | Accent, success, warning, and danger are each given layered gradient treatment, which diffuses semantic clarity. |

The redesign should likely keep the deep slate/navy base and teal/cyan primary actions while tightening the use of amber accent and keeping any magenta/coral flourish extremely limited.

### 6. Current patterns do not express the requested design-system lens

Requested lens:

- Trust & Authority + Conversion pattern
- Exaggerated Minimalism
- Productivity Tool

Current implementation:

| Evidence | Technical finding |
|---|---|
| `web/src/app/controller.ts:135-161` | Hero copy is friendly and descriptive but not strongly trust-oriented. |
| `web/src/app/controller.ts:183-308` | Intake surface is technically descriptive but not conversion-optimized. |
| `web/src/app/controller.ts:350-393` | Success metrics exist, but there is no explicit proof or capability block. |
| `web/src/app/controller.ts:499-526` | Recovery/help exists only after warnings appear. |

The current system behaves as a feature-complete demo surface, not as a refined productivity tool with authority cues.

## Pattern implications for redesign

1. Preserve dark base + cool elevated surfaces, but reduce translucency and blur materially.
2. Add a display serif only where hierarchy requires it: hero line, section entry, possibly numeric proof moments.
3. Shift from soft-glass cards to sharper layered panels with stricter borders and tighter spacing.
4. Reframe accent usage around task initiation, confidence, and high-value proof rather than atmospheric glow.
5. Introduce a persistent trust/proof block that communicates local processing, supported baseline, and capability envelope.

## Open questions

1. Should `Playfair Display` or `Newsreader` be preferred for display moments, given the explicit `Playfair Display` reference on `samuelmok.cc` and the task’s allowance for either?
2. Should the current light theme be preserved as a fully designed variant, or should design effort concentrate on the requested desktop-first dark direction first?
3. Should semantic colors be expressed as more neutral line/label states rather than broad tinted surfaces?
4. How much of the existing gradient atmosphere should remain once blur is removed?

## Risks

1. Over-borrowing from `samuelmok.cc` could accidentally import novelty navigation or art-direction patterns that the task explicitly excludes.
2. Introducing a serif display font too broadly could reduce table and form clarity.
3. Tightening surfaces without revisiting spacing and hierarchy could make the UI feel colder without improving usability.
4. Recoloring without semantic restructuring would preserve the current generic dark-glass identity under a different palette.

## Dependencies

1. Typography changes depend on `web/index.html`, `web/src/styles.css`, and potentially font asset strategy.
2. Surface and token changes depend on a redesign of `web/src/styles.css` and may be easier if markup is decomposed into clearer sections.
3. Trust/proof pattern adoption depends on IA changes in `web/src/app/controller.ts` or successor view modules.

## Testing implications

1. Visual verification is required because token and surface changes cannot be validated adequately with current logic-only tests.
2. Color and contrast changes require explicit accessibility review, especially in warning/error states.
3. Typography changes should be tested under zoom and large-text conditions because the redesign explicitly targets desktop ergonomics.
4. Reduced-motion behavior must be revalidated after any surface animation or hover treatment changes.

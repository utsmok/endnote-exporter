# Documentation Research — `web-ui-ux-refresh`

## Scope

This report inventories existing documentation relevant to the browser-local application and identifies documentation constraints and opportunities for a UI/UX redesign plan.

## Findings

### 1. The browser-local product contract is already well documented

| Document | Evidence | Technical relevance |
|---|---|---|
| `docs/local-web-execution/contracts.md` | Defines served-mode baseline, ZIP-first intake, direct-folder enhancement status, and non-goals. | The redesign must not visually imply unsupported launch modes or broader intake promises. |
| `docs/local-web-execution/support-matrix.md` | Freezes capability-based support tiers. | Direct-folder intake and browser support messaging must remain conservative. |
| `docs/local-web-execution/attachment-policy.md` | Documents `metadata-only-no-links` vs `base-library-path-links`. | Attachment UI changes must preserve explicit browser-local honesty. |
| `docs/local-web-execution/user-guide.md` | Documents the current user flow and result summary behavior. | The redesign will require a documentation update because the IA target differs from the current flow description. |
| `docs/local-web-execution/troubleshooting.md` | Enumerates failure states and baseline advice. | Recovery/help surfaces in the redesign should stay aligned with these documented causes. |

From a planning standpoint, the redesign is not starting from an undocumented product. It is starting from a clearly documented product that now needs a clearer, more desktop-oriented surface.

### 2. Prior planning documents establish a planning pattern and useful constraints

| Document | Evidence | Relevance |
|---|---|---|
| `docs/local-web-execution_PLAN.md` | Consolidated plan for browser-local implementation, including tasks, risks, and testing. | Establishes the browser-local contract and phased delivery logic the redesign should respect. |
| `docs/platform-and-web-port_PLAN.md` | Consolidated hybrid plan for desktop hardening and hosted web work. | Useful mainly as contrast; hosted API assumptions are intentionally out of scope for this redesign. |
| `docs/cross-platform-compatibility_PLAN.md` | Earlier desktop compatibility plan. | Confirms the repository’s broader planning conventions and desktop constraints. |

The existing planning corpus indicates a preference for conservative scope control, explicit contracts, and wave-based sequencing. The redesign package should maintain that style.

### 3. Existing docs already expose trust and capability messaging that the UI does not yet capitalize on

The current browser-local docs repeatedly emphasize:

1. local processing on the user’s device
2. served-mode baseline
3. ZIP-first stable path
4. direct-folder intake as experimental
5. attachment-path honesty
6. desktop application as fallback

These are strong trust-and-authority signals. The current UI references some of them, but they are distributed among tooltips and disclosures rather than consolidated into a proof/capability block.

### 4. External documentation reveals useful audience framing

The fetched article `https://libraet.samuelmok.cc/posts/endnote-export/` contributes useful messaging patterns:

1. domain-specific pain points are explicit: PDF transfer difficulty, metadata date loss, and migration risk
2. the authorial tone communicates subject-matter expertise rather than startup-style persuasion
3. user guidance is procedural and conservative, with explicit fallback/help instructions

This is compatible with the requested Trust & Authority + Conversion pattern. The browser-local redesign should not look like generic SaaS onboarding. It should look like a specialist migration utility with calm operational confidence.

### 5. The current README positions both desktop and browser-local surfaces

| Evidence | Technical finding |
|---|---|
| `README.md:1-18` | Desktop application remains primary historical product description. |
| `README.md:37-53` | Browser-local workflow is documented conservatively and links to the contract docs. |

The redesign plan therefore needs to maintain coexistence between the desktop app and browser-local surface. It should not imply replacement unless documentation strategy changes later.

## Documentation gaps relevant to redesign

1. No dedicated design brief or visual rationale exists for the browser-local UI.
2. No screenshot-backed documentation exists for the current browser-local surface.
3. Current docs describe the current flow accurately, but they do not document a desktop-first review workspace because none exists.
4. There is no design-system or token documentation for the browser-local UI.
5. There is no formal documentation of severity taxonomy because the UI presently exposes warning codes without a broader semantic model.

## Improvement opportunities

1. Add a redesign brief or UI specification document after plan approval.
2. Update user guide and troubleshooting docs after implementation to reflect the revised IA and results review model.
3. Add release-ops notes for visual verification and accessibility verification in the redesign release process.
4. Document the relationship between desktop oracle behavior and browser-local UI messaging more explicitly, especially for attachment behavior and degraded states.

## Open questions

1. Should the redesign produce a dedicated visual-spec document in addition to implementation docs?
2. Should README messaging change only after implementation, or should the redesign plan include intermediate preview-language updates?
3. Should severity terminology be documented first in docs or first in code/tests?
4. Should the browser-local user guide gain explicit "What changed in the redesigned UI" release notes once implemented?

## Risks

1. A UI that looks materially more capable than the documented contract would create user trust debt.
2. Documentation lag after redesign could cause support friction because the browser-local docs are currently precise.
3. Over-indexing on external branding cues could obscure the product’s conservative runtime constraints.
4. If the redesign adds advanced review ergonomics without documentation, support channels will inherit the explanation burden.

## Dependencies

1. The redesign documentation must remain consistent with the existing local-web-execution contract suite unless those documents are explicitly revised.
2. User-guide and troubleshooting updates depend on the chosen IA and results review model.
3. Any new visual verification procedure depends on test/release process updates.

## Testing implications

1. Documentation updates should be coupled to UI changes in the same delivery wave to avoid support drift.
2. Release verification should include screenshot or manual comparison against documented IA and capability wording.
3. If severity taxonomy changes are introduced, tests should validate terminology before docs are updated.
4. Trust/proof messaging in the UI should be validated against documented support policy, not only against aesthetic preference.

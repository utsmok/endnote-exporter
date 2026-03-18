# Browser-Local Privacy and Data Handling Policy

**Status:** Frozen for MVP planning
**Date:** 2026-03-18
**Applies to:** Browser-local conversion surface only

## Purpose

This document defines the intended privacy and data-handling posture for the browser-local MVP.

The goal is a browser-delivered workflow in which conversion executes on the user's device by default, without introducing a hosted conversion service as the primary runtime.

This document does not change the behavior of the existing Python desktop application.

## Core posture

The browser-local MVP is intended to process approved user-selected EndNote library input locally in the browser runtime on the user's device.

The canonical runtime is a served browser application over `http://localhost` or `https://...`. This runtime requirement is a technical delivery constraint. It is not a statement that user library contents must be uploaded to a remote conversion service.

## Data handling baseline

For the supported browser-local flow:

- the application is intended to read user-selected input locally in the browser runtime
- conversion is intended to occur locally on the user's device
- the generated XML artifact is intended to be produced locally and delivered back to the user as a local download
- the MVP does not include a project-controlled server-side conversion step as part of the baseline product contract

## Explicit privacy boundaries

The following statements are part of the product policy:

1. The browser-local MVP is not a hosted document-processing service.
2. Supported use of the browser-local MVP does not require uploading EndNote library contents to a project-controlled backend for conversion.
3. A served runtime may still involve ordinary static-asset delivery, browser caching, and local browser storage behavior that are normal for web applications.
4. If the application is deployed by a third party, that deployment environment may create routine web-server access logs for application delivery. That does not, by itself, redefine the conversion model as server-side processing.

## Attachment-specific privacy note

Browser-local attachment handling is intentionally narrower than the desktop exporter's attachment behavior.

The browser-local MVP does not promise desktop-style absolute filesystem paths for attachments. This reduces reliance on host path disclosure and reflects the fact that the browser runtime does not provide the same filesystem contract as the desktop application.

## Unsupported launch mode note

Direct `file://` launch is unsupported for MVP. Users and deployers must not treat unsupported `file://` use as the privacy or security reference model for the browser-local product surface.

## Retention and persistence posture

The browser-local MVP should be documented and implemented with the following conservative assumptions:

- no intentional server-side retention of library contents is part of the baseline contract
- temporary in-browser state, cache behavior, or origin-scoped storage may exist as required by the runtime and implementation
- any persistence beyond the active session must be documented explicitly if introduced later

Current implementation notes:

- theme preference may be stored locally so the workspace can reopen in the user's chosen appearance mode
- conversion and review data are treated as in-memory session state rather than durable browser-local records
- the application may store a minimal phase marker for interrupted-session messaging, but not the prior review payload itself
- after refresh or tab replacement, the previous review workspace is intentionally not restored

## Fallback surface

Users who require the established desktop runtime should continue to use the Python desktop application.

The desktop application remains the unaffected fallback surface while browser-local work is evaluated and implemented incrementally.

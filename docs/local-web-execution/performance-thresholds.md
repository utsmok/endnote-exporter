# SQLite/WASM Continuation Thresholds

**Task:** T003 — Run SQLite/WASM feasibility spike and define thresholds
**Date:** 2026-03-18
**Status:** Initial threshold set for browser-first continuation decisions

## Purpose

This document defines **continuation thresholds**, not observed benchmark results.

Observed results from this session are documented in `feasibility.md`.

The thresholds below answer a different question:

> At what point should the project continue investing in a browser-first SQLite/WASM path, and at what point should it escalate to wrapper fallback review?

## Important interpretation rule

Because the current approved fixture corpus is still small, these thresholds are intentionally conservative.

They are meant to govern:

- continued implementation of the browser-first path
- future larger-fixture validation work
- wrapper fallback escalation

They are **not** public product guarantees.

## Observed evidence floor from this session

The current measured floor is:

- largest approved archive exercised by the spike: **56.68 KiB** (`stress-large.zip`)
- largest database payload exercised by the spike: **56.00 KiB**
- largest record volume exercised by the spike: **250 rows**
- failure classifications correctly separated for:
  - `missing-database`
  - `malformed-archive`

This means the browser-first architecture has earned the right to proceed, but only within a still-small tested envelope.

## Continuation thresholds

### 1. Archive-size threshold

#### Current evidence-backed floor

- Treat archives up to **64 KiB** as the only size envelope directly exercised by T003.

This is a rounded-up evidence floor from the current corpus, not an MVP promise.

#### Continuation gate for browser-first work

Before the project claims broader practicality, the same spike path should successfully process an approved larger corpus meeting **all** of the following:

- archive size at least **1 MiB**
- database payload at least **512 KiB**
- three consecutive successful worker runs in the canonical served browser runtime
- no unclassified worker termination

#### Wrapper escalation trigger

Escalate to Electron/Tauri review if the browser worker path cannot process a representative approved archive at or below:

- **1 MiB archive size**, or
- **512 KiB database payload**

without repeated crashes, unclassified failure, or unusable latency.

## 2. Latency threshold

### Current evidence-backed floor

Observed median worker totals in this session were approximately:

- **12-18 ms** for the small supported fixtures
- **15.24 ms** for the 250-row stress fixture

These are useful only as feasibility lower-bound evidence.

### Continuation gate for browser-first work

For approved supported fixtures in the browser worker path:

- fixtures at or below the current 250-row stress shape should remain under **250 ms median total worker time**
- a future approved **1 MiB-class** archive should remain under **2.0 s median total worker time**
- no single supported-fixture run should exceed **5.0 s** without surfacing a structured progress or limit warning

### Wrapper escalation trigger

Escalate to wrapper review if, in the canonical served Chromium path:

- the 250-row stress fixture repeatedly exceeds **250 ms median** after integration stabilizes, or
- a future approved **1 MiB-class** archive repeatedly exceeds **2.0 s median**, or
- any supported fixture repeatedly exceeds **5.0 s** without a graceful, user-visible limit response

## 3. Memory-failure behavior threshold

### Why this is behavior-first rather than byte-first

The T003 spike only has coarse worker memory observations, and the fixed WASM/runtime overhead is materially larger than the tiny fixture sizes in the current corpus.

Because of that, a raw-memory-cap number from this session would be misleading.

### Continuation gate for browser-first work

The browser-first path remains acceptable only if memory pressure is handled with **structured failure behavior**:

- **0 silent partial outputs** on supported fixtures
- **0 unclassified worker exits** on supported fixtures
- **0 browser-tab crashes** during supported fixture runs
- any limit breach must resolve to a classified error or warning state rather than a hung or dead worker
- repeated runs of the same supported fixture must remain recoverable without a full-page reload requirement

### Wrapper escalation trigger

Escalate to wrapper review if any of the following occur on approved supported fixtures:

- repeatable out-of-memory termination without classified error handling
- browser tab kill or renderer crash
- worker death that leaves the UI unable to retry cleanly
- partial XML output after a memory-related failure

## 4. Wrapper-fallback escalation threshold

Wrapper review is no longer optional once **any** of the following are true in the canonical served browser runtime:

1. the worker path cannot reliably process approved archives up to **1 MiB**
2. the worker path shows repeatable unclassified crashes on supported fixtures
3. latency for the approved browser-local path remains above the thresholds in this document after normal optimization work
4. memory failures cannot be converted into clean user-visible failure states
5. later tasks reveal that required filesystem or attachment semantics materially exceed the browser-local contract

If one of these triggers is hit, the correct response is:

- keep the browser-local implementation narrow and honest
- stop expanding support claims
- open the wrapper decision path described later in `T015`

## Recommended status after T003

Based on the evidence currently available:

- **Continue** with the browser-first path for `T006`-`T010`
- **Do not** broaden archive-size claims yet
- **Do not** promise large-library support yet
- **Do** treat the thresholds above as the next hard gate before broad support claims or release-level confidence

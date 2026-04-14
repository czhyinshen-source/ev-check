# Snapshot Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hierarchical, item-centric detail view for snapshots with a summary header card.

**Architecture:** 
- Add a combined backend endpoint for efficient data fetching.
- Use a CSS-based accordion/tree structure for the "Check Item > Hostname > Content" drill-down.
- Vanilla JS rendering for performance and zero dependencies.

**Tech Stack:** Python (FastAPI/SQLAlchemy), JavaScript (Vanilla), CSS3 (Flexbox/Transitions).

---

### Task 1: Backend - Combined Detail Endpoint
**Files:**
- Modify: `app/api/snapshots.py`

- [ ] **Step 1: Implement `get_snapshot_full_details` endpoint**
  Add a new route `GET /api/v1/snapshots/{snapshot_id}/full_details` that returns:
  - Snapshot metadata.
  - Summary stats (calculated count of instances and their status).
  - All `EnvironmentData` joined with `SnapshotInstance` and `Communication` info, grouped by `check_item_id`.

- [ ] **Step 2: Commit backend changes**

### Task 2: Frontend - UI Structure
**Files:**
- Modify: `app/static/dashboard.html`
- Create: `app/static/css/snapshot-detail.css`

- [ ] **Step 1: Add Detail View Overlay**
  Define a full-screen or large modal container `#snapshotDetailOverlay` in `dashboard.html`.

- [ ] **Step 2: Define CSS for Tree/Accordion**
  Implement `.snapshot-tree`, `.tree-node`, `.host-node`, and `.content-blob` (monospace) styles.

- [ ] **Step 3: Commit UI structure**

### Task 3: JS Logic - Data Fetching & Rendering
**Files:**
- Modify: `app/static/js/snapshots.js`

- [ ] **Step 1: Implement `viewSnapshotDetail(id)`**
  This function will trigger on clicking "Detail" in the snapshot table.
  - Fetch data from the new `full_details` endpoint.
  - Populate the Summary Card.

- [ ] **Step 2: Implement `renderSnapshotTree(data)`**
  - Loop through grouped check items.
  - Create expandable DOM elements for Items and Machines.
  - Inject the raw content into pre-formatted blocks.

- [ ] **Step 3: Commit JS implementation**

### Task 4: Integration & UX Polish
- [ ] **Step 1: Link Table Action**
  Ensure the "详情" button in the snapshots list calls `viewSnapshotDetail(id)`.

- [ ] **Step 2: Add Search Filter**
  Implement a simple text filter that shows/hides tree nodes based on Check Item name.

- [ ] **Step 3: Final Commit & Cleanup**

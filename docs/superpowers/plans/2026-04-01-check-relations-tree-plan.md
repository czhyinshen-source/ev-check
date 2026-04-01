# Check Relations Tree & Snapshot Auto-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a cascading tree for relation selections and auto-fill communication/check items when a baseline snapshot is selected.

**Architecture:** Frontend vanilla JS + HTML refactoring. The `multiSelectModal` will be updated to render a recursive checkbox tree. State tracking will be introduced for Snapshot auto-fill dependency management. Back-end APIs remain unchanged.

**Tech Stack:** Vanilla JavaScript, HTML, CSS.

---

### Task 1: Update Modal HTML Structure
**Files:**
- Modify: `app/static/dashboard.html`

- [ ] **Step 1: Refactor multiSelectModal HTML**
Update the modal body to remove the old Tab navigations (Individual/Group) and replace it with a single `.tree-container` for rendering the hierarchical list. Add basic CSS styles for the tree if not already present.

- [ ] **Step 2: Commit modal structure**
```bash
git add app/static/dashboard.html
git commit -m "refactor(ui): update multi-select modal to support tree view layout"
```

### Task 2: Implement Tree Node Rendering Logic
**Files:**
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: Fetch Group & Instance Data**
Update `openMultiSelectModal` to fetch both Groups and Individuals for Communications and Check Items to build the hierarchical node map.

- [ ] **Step 2: Recursive render component**
Write a `renderTreeNode(node, selectedSet)` JS function that creates the HTML string for nested `<ul>` and `<li>` elements, inserting standard checkboxes for leaf nodes and grouped inputs for parent nodes.

- [ ] **Step 3: Modify modal injection**
Inject the rendered tree HTML into the `.tree-container`.

- [ ] **Step 4: Commit rendering logic**
```bash
git add app/static/js/checks.js
git commit -m "feat(ui): implement recursive tree rendering for groups and items"
```

### Task 3: Cascading Selection State Management
**Files:**
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: Implement cascading event listeners**
Bind `change` events to checkboxes in the tree. When a parent node is toggled, recursively toggle all its children checkboxes.

- [ ] **Step 2: Parent state bubbling**
Implement logic so that when a leaf node is toggled, it evaluates its siblings to update the parent node checkbox into checked, unchecked, or indeterminate `-` state.

- [ ] **Step 3: Pure leaf-node extraction**
Update `confirmMultiSelect` to ONLY loop through `.leaf-node input:checked` to extract IDs, completely ignoring group IDs, and save them to `selectedRelations.[type].ids`.

- [ ] **Step 4: Commit cascading logic**
```bash
git add app/static/js/checks.js
git commit -m "feat(ui): implement cascading tree checkbox states and leaf extraction"
```

### Task 4: Snapshot Auto-Fill Dependencies
**Files:**
- Modify: `app/static/js/checks.js`

- [ ] **Step 1: State map initialization**
Declare a module-level variable `let snapshotDependencies = {};` to track IDs injected by snapshots.

- [ ] **Step 2: Snapshot Toggle Interceptor**
When user saves the modal specifically for `snapshot`, intercept the selection changes. For every newly added `snapshot_id`, fetch `/api/v1/snapshots/instances?snapshot_id=ID`.
Extract `communication_id`s and `check_item_list_id`.

- [ ] **Step 3: Dependency Mapping and List Update**
Update `snapshotDependencies[snapshot_id]` with the fetched contents. Push the IDs into `selectedRelations.communication.ids` (de-duplicated).
For removed snapshots, delete the corresponding IDs from `selectedRelations` that were tracked in `snapshotDependencies[snapshot_id]` (if they exist).

- [ ] **Step 4: Auto re-render UI**
After the invisible merge of IDs, invoke `renderRelationsPills` to show the newly hydrated communications and items instantly in the rule details UI.

- [ ] **Step 5: Commit Snapshot Auto-fill**
```bash
git add app/static/js/checks.js
git commit -m "feat(api): implement auto-fill and dependency tracking for baseline snapshots"
```

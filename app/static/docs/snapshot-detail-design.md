# Snapshot Detail Design Spec (2026-04-07)

## 📌 Goal
Implement a hierarchical "Check Item -> Host -> Raw Content" drill-down view and a summary card for Snapshot Details.

## 🏗️ Design
1. **Summary Card**: Items Count, Hosts Count, Completion %, Start/End Time.
2. **Interactive Tree (Accordion)**:
   - Expand Check Items (e.g. `/etc/hosts`).
   - Expand Hostnames (e.g. `Server-01`).
   - Show Raw Content directly (Pre-formatted monospace text).
3. **Pure Observation**: No diffs, no comparisons, no status PASS/FAIL logic.

## 🛠️ Data Strategy
- Fetch `EnvironmentData` per `SnapshotID`.
- Group by `CheckItemID` in frontend logic.
- Render in an expandable list format.

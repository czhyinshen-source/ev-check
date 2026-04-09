# Check Report & Execution Architecture Design

## 1. Overview
The current Check Execution system will be decoupled. 
- "Check Execution" becomes the **Rule Management Center** (Configuration).
- "Check Reports" becomes the unified **Task & Report Center** (Monitoring & Results).
This design unifies both manual and scheduled check tasks into a single aggregate model that provides real-time progress tracking and a hierarchical drill-down report.

## 2. Architecture & Data Model

We introduce `CheckReport` to aggregate individual `CheckResult`s.

### `CheckReport` Model (New)
Represents a single execution run (batch) of a rule.
- `id`: PK
- `rule_id`: FK
- `name`: Auto-generated string (e.g., "RuleName - 20260409_1052")
- `trigger_type`: 'manual' | 'scheduled'
- `status`: 'pending', 'running', 'success', 'failed', 'cancelled'
- `total_nodes`: int (total machines to check)
- `completed_nodes`: int
- `success_nodes`: int
- `failed_nodes`: int
- `start_time`: datetime
- `end_time`: datetime

### `CheckResult` Model (Modified)
- Add `report_id`: FK to `CheckReport` (nullable=False for new records)

## 3. Detailed UI Presentation

### 3.1. Rule Management Tab (Formerly "Checks")
- **Layout**: Left sidebar (rule tree), center content (rule editor).
- **Changes**: Remove the "Result Panel / Execution Console" from the bottom.
- **Action**: Add a "Run Now" button to the rule editor. Clicking it creates a `CheckReport` and redirects the user to the Reports tab.

### 3.2. Task & Report Center Tab (Formerly "Reports")
- **Layout**: A data table tracking all `CheckReport` objects (both manual and scheduled).
- **Columns**:
  - Report / Task Name
  - Trigger Type (Manual / Scheduled)
  - Progress (Progress Bar `completed_nodes / total_nodes`)
  - Status (Running, Success, Failed)
  - Time (Start - End)
  - Actions: "View Report" (opens if generated), "Terminate" (if running).

### 3.3 Report Drill-Down View (The Cascading UI)
Clicking "View Report" opens a full-screen drawer or large modal with 4 levels of depth.

1. **Header Overview**: Radar/Timeline, Total Nodes vs Passed/Failed.
2. **Level 1 (Check Items)**: Grouped by configuration item checked.
   - Example: `[etc/hosts check] - (🟩 8 Pass, 🟥 2 Fail)`
   - *Collapsible Accordion*
3. **Level 2 (Communications/Machines)**: Expanding a failed Check Item reveals the machines.
   - Example: `Web-Node-02 - 🟥 Fail`
4. **Level 3 (Diff/Detail Panel)**: Clicking the machine opens a Git-style Diff.
   - **Left**: Baseline/Expected value
   - **Right**: Collected/Actual value
   - *Visually highlights exact missmatches.*

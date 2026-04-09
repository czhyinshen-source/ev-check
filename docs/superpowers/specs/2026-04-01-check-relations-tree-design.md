# Check Relations Tree & Snapshot Auto-fill Design

## Overview
This design improves the EV Check rule creation/editing user experience by replacing flat list selections with cascading tree structures and introducing automatic dependency management when selecting baseline snapshots.

## 1. Cascading Tree Selection (Communication & Check Items)
### Motivation
Users need to clearly see and select individual communications and check items by their logical grouping without the black-box nature of "Group IDs".

### Architecture
*   **UI Component**: A custom, recursive checkbox tree component inside the `multiSelectModal`.
*   **Structure**: 
    *   Root nodes map to Groups (e.g., `CommunicationGroup`, `CheckItemList`).
    *   Leaf nodes map to individual instances (e.g., `Communication`, `CheckItem`).
*   **Interactions**:
    *   Checking a parent node automatically checks all its children.
    *   Unchecking a child updates the parent node to an "indeterminate" state `-` (if siblings are checked) or empty ` ` (if all siblings are unchecked).
    *   Expanding/collapsing tree nodes for better visibility.
*   **Data Payload**: Only leaf node IDs (`communication_ids`, `check_item_ids`) are extracted and saved to the backend. `group_ids` are omitted from the check rule payload, ensuring the payload reflects identical state to what the user sees (individual items).

## 2. Snapshot Auto-fill Mechanism
### Motivation
When a baseline snapshot is chosen, its associated communications and check items should automatically populate the rule's target parameters to prevent manual double-entry.

### Protocol/Flow
1.  **Selection Event**: User selects a `Snapshot` inside the snapshot modal.
2.  **API Fetch**: The frontend fetches `/api/v1/snapshots/instances?snapshot_id={id}` to retrieve all `communication_id`s and the snapshot's `check_item_list_id` (and subsequently all items in that list).
3.  **State Mapping**: The frontend maintains a `snapshotDependencies` map:
    ```javascript
    {
      [snapshotId]: {
        comms: [id1, id2],
        items: [idX, idY]
      }
    }
    ```
4.  **Auto-population**: The fetched IDs are automatically added to the current `selectedRelations.communication.ids` and `selectedRelations.check_item.ids`, triggering a UI re-render (Pills appear).
5.  **Reversion Event**: If the user unchecks the snapshot, the frontend uses `snapshotDependencies` to identify which IDs were brought in by this snapshot and removes them from the global selected pool (unless the user had manually checked them prior, which is tracked via Set intersections).

## 3. Data Flow & Testing
*   **Backend Changes**: None required. `create_check_rule` and `update_check_rule` already support `communication_ids` and `check_item_ids` as lists.
*   **Frontend Changes**: Refactoring `openMultiSelectModal` in `checks.js` to render the recursive tree instead of tabs, and implementing the `onSnapshotToggle` hook.
*   **Error Handling**: If snapshot instance fetching fails, the system will alert the user and skip auto-population.

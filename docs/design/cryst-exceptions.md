# Cryst Exceptions (live session screen)

The Cryst design system is the whole vocabulary for migrated screens. A migrated screen that needs something the system does not describe builds it as an **exception**: local to that screen, recorded here with its reason, and never a precedent for another screen. If a second screen needs the same thing, propose it to the design system as a component instead of copying it. The design system's README lists the same exceptions under "Exceptions" and points here for the reasons.

Scope: the Cryst live session screen, `apps/web/src/features/live-sessions/pages/live-session-page/` (route `/active-session-next`). The temporary `.cryst` token scope itself is described in [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md).

## What the implementation takes from the system

Everything not listed under [Exceptions](#exceptions) follows a design-system component. The Cryst primitives live in `live-session-page/cryst-controls.ts` (Button, field surfaces, Badge, Card, Alert, list row, Tag, pill Tabs), `segmented-control.tsx` (SegmentedControl), `radio-card.tsx` (RadioCard), and `sheets/` (BottomSheet, Dialog).

- **BottomSheet comes in two kinds.** A sheet that can close at any time (Timeline, Currency) has a grab and a centered title, and closes by dragging, a scrim tap, or Esc (`CrystSheet`). A sheet that needs an explicit decision (Session, Master link, Event editor, Sit-in, Scan seats, End session) has no grab, cancels with × at the top left and confirms with ✓ at the top right, and closes in no other way (`CrystFormSheet`, `dismissible={false}`). Never give an explicit sheet a grab.
- **Pill tabs** draw the selected item on `--tab-active` (white in light, a raised gray in dark) so the selection stays visible on the dark `muted` track.
- **SegmentedControl** (Direction, Ante type, scan Keep / Replace) and **RadioCard** (chip purchase option) are radio groups: arrow keys move and select. Both are built on the Radix radio group, like `features/settings/.../theme-setting`.
- Mobile sizes use the `--m-*` tokens: pill tabs and SegmentedControl at `--m-control`, RadioCard rows at `--m-list-row`, sheet header icons at `--m-control`.

## Exceptions

| Exception | Where | Reason |
|---|---|---|
| Bottom ActionBar: 48px tiles, icon above an 11px (`--text-xs`) label | `action-bar/` | Specified by the screen's design file (`ActionBar.dc.html`). The system's only bottom bar is the navigation tab bar, and these are recording actions, not navigation. |
| Inline edit fields without a border until focused, committed on blur | `CRYST_INLINE_FIELD`; `selected-player-panel/`, `sheets/scan-seats-sheet/scan-review-row.tsx` | Specified by the design file for editing names in place inside rows. The player panel has no Save action, so edits commit on blur (P3a, SA2-222). |
| Leave and Delete as an outline Button with `destructive` text | `selected-player-panel/`, `sheets/event-editor-sheet/` | Specified by the design file. The system's destructive Button is solid; these are secondary actions next to the surface's main content. |
| Full-height Timeline sheet and event-type colors on its markers | `sheets/timeline-sheet/`, `event-visuals.ts` | User-directed in P2 (SA2-221). The marker colors are semantic tokens mixed into `background`, not new hues. |
| Hero seat and hero row highlighted in `primary`; seat markers and avatars tinted by player kind | `table-view/seat-marker/`, `player-picker/` | The hero highlight and the player-color markers are specified by the design file (`SeatMarker.dc.html`); the kind tints in the player picker (temporary, anonymous) were user-directed. The system reserves `primary` for actions and selection. |
| Blinds tab rows: the running level tinted with `primary` at 10%, breaks labeled in `warning`, and a pill-shaped Games button tinted with `info` once the level has its own games | `sheets/session-sheet/session-blinds-tab.tsx` | Specified by the design file's Blinds tab. The system reserves `primary` for actions and selection and has no pill button. A level without games carries an icon-only Games button instead of the design's dashed pill (see the one-line rows below) (P4b, SA2-224; P4c, SA2-225). |
| Paused-session veil: `background` at 72% with a 2px blur over the cockpit | `paused-overlay/` | Specified by the design file. It is the only transparency besides the sheet scrim. |
| Compact master-drift notice (tighter padding than Alert): the banner on the Basics and Blinds tabs (Reset to master only) and the row inside the Overview master card (Update master only) | `sheets/session-sheet/session-sheet.tsx`, `sheets/session-sheet/session-overview-tab.tsx` | User-directed in P4a (SA2-223); split by tab in P4c (SA2-225). |
| Unlinked-master notices tinted with `warning`: the Overview card's warning border and fill, and the borderless 12% notice at the top of the Master link sheet | `sheets/session-sheet/session-overview-tab.tsx`, `sheets/master-link-sheet/` | Specified by the design file's Overview card and Master sheet (P4c, SA2-225). The system's Alert and Card sit on `card` with a neutral border. |
| Seat map: seat names at 8px, below the 11px floor | `table-view/seat-marker/seat-marker.tsx` | User-directed when names were added to the markers; kept by decision in P4a (SA2-223). |
| Seat map: 34px square scan and clear-seats buttons, below the 44px target | `table-view/table-view.tsx` | Kept at the original 34px by decision in P4a (SA2-223). The square shape follows the system's icon Button. |
| Blinds tab level rows below the 44px target, one line per level: 32px cells for the blinds, the ante and the minutes, a 24px icon-only Games button and a 22px remove button; a level with games takes one more line per game group, each stake a 32px field with its caption stacked above the value | `sheets/session-sheet/session-blinds-tab.tsx` | User-directed in P4c (SA2-225): at the 44px target each level took two 44px lines and a structure no longer fit on screen, and then each level and each game group was asked to fit on one line. The design file puts the third blind, the ante and the Games pill on a second line. The default-minutes field and the Add level / Add break buttons keep the system sizes. |
| Sans face is Noto Sans (Latin), not Noto Sans JP | `apps/web/src/index.css` | `--font-sans` is a literal in `@theme inline`, so the `.cryst` scope cannot change it; adopting the Japanese face is an app-wide change tracked in SA2-237. |

## Behavior that differs from the system's reference

These are platform differences, not visual exceptions:

- A dismissible sheet (vaul `Drawer`) can be dragged down from anywhere on the sheet, not only from the grab.
- In SegmentedControl and RadioCard, Home and End move focus to the first and last option without selecting it (Radix radio group); the arrow keys select.

## Transitional reuse

The End session and End tournament sheets render Cryst fields but take their form state and validation from the old screen's completion-form hooks (`useCashGameCompleteForm`, `useTournamentCompleteForm` in `features/live-sessions/components/`), so cash-out and result validation keeps one source (SA2-113, SA2-137). The hooks move into the Cryst tree when the old live session screen is deleted (SA2-229).

## Removing an exception

When the system gains a component for an exception, or the screen stops needing it, delete the row here and the matching line in the design system's README in the same change.

# Cryst Exceptions

The Cryst design system is the whole vocabulary for migrated screens. A migrated screen that needs something the system does not describe builds it as an **exception**: local to that screen, recorded here with its reason, and never a precedent for another screen. If a second screen needs the same thing, propose it to the design system as a component instead of copying it. The design system's README lists the same exceptions under "Exceptions" and points here for the reasons.

The temporary `.cryst` token scope is described in [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md). SA2-427 removed the unused components; future v2 UI screens re-add design-system components when needed and record any new exceptions here.


## Removing an exception

When the system gains a component for an exception, or the screen stops needing it, delete the row here and the matching line in the design system's README in the same change.

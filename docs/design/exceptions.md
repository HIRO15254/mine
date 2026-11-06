# Design-system exceptions

Mine Design System is the whole vocabulary for Mine's UI. A screen that needs something the system does not describe builds it as an exception: local to that screen, recorded here with its reason, and never precedent for another screen. When the same exception is needed a second time, add it to Mine Design System as a component instead.

| Screen | What differs from Mine Design System | Why |
|---|---|---|
| All | The sidebar and the bottom tab bar are the app's own (`apps/web/src/components/app-shell/`), not the system's Sidebar component. | The shell predates the Sidebar port; it follows the Desktop and Mobile frame patterns. |

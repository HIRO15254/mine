# Cryst exceptions

Cryst is the whole vocabulary for Mine's UI. A screen that needs something Cryst does not describe builds it as an exception: local to that screen, recorded here with its reason, and never precedent for another screen. When the same exception is needed a second time, propose it to the Cryst Design System as a component instead.

| Screen | What differs from Cryst | Why |
|---|---|---|
| All | The sidebar and the bottom tab bar are the app's own (`apps/web/src/components/app-shell/`), not Cryst's Sidebar component. | The shell predates the Sidebar port; it follows the Desktop and Mobile frame patterns. |

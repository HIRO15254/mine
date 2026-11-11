# Design-system exceptions

Mine Design System is the whole vocabulary for Mine's UI. A screen that needs something the system does not describe builds it as an exception: local to that screen, recorded here with its reason, and never precedent for another screen. When the same exception is needed a second time, add it to Mine Design System as a component instead.

| Screen | What differs from Mine Design System | Why |
|---|---|---|
| All | The sidebar and the bottom tab bar are the app's own (`apps/web/src/components/app-shell/`), not the system's Sidebar component. | The shell predates the Sidebar port; it follows the Desktop and Mobile frame patterns. |
| All (launch) | The launch animation in `apps/web/index.html` is plain inline CSS with the token colors copied as hex values, and the first screen's cards rise in once after it (`app-enter`). | It has to show before the app's CSS and fonts load; the system has no launch pattern yet. |

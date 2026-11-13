# Design-system exceptions

Mine Design System is the whole vocabulary for Mine's UI. A screen that needs something the system does not describe builds it as an exception: local to that screen, recorded here with its reason, and never precedent for another screen. When the same exception is needed a second time, add it to Mine Design System as a component instead.

| Screen | What differs from Mine Design System | Why |
|---|---|---|
| All | The sidebar and the bottom tab bar are the app's own (`apps/web/src/components/app-shell/`), not the system's Sidebar component. | The shell predates the Sidebar port; it follows the Desktop and Mobile frame patterns. |
| All (launch) | The launch animation in `apps/web/index.html` is plain inline CSS with the token colors copied as hex values. It fills the whole screen (prism light, rays, shock waves and sparks around the mark) and leaves through an iris that opens from the middle; the first screen's cards rise in once after it (`app-enter`). With reduced motion only the still mark shows. | It has to show before the app's CSS and fonts load; the system has no launch pattern yet. |
| Calendar | The time rail's detail card (`time-rail.tsx`) is a small popover built in place from the popover tokens, opened by hover or tap. | The system has no Popover or Tooltip; the card is the only one so far. |
| Calendar | The month grid (`month-grid.tsx`) is the app's own: day cells with event and task chips, and thin bars on the phone. | The system has no calendar component; it reuses the time grid's chips and colors. |
| Calendar | The time scale's zoom buttons in the grid's corner (`time-grid.tsx`) are ghost IconButtons shrunk to 20px. | They share the 2.75rem hour gutter, where two `sm` buttons do not fit; a pinch or ctrl + wheel does the same. |

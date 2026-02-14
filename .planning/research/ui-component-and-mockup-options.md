# UI Component and Mockup Options (Core-First Research)

## Decision Banner

- **Current implementation decision:** Keep `shadcn/ui` direction for this phase.
- **Purpose of this document:** research alternatives and mockup tooling for future decisions without blocking current execution.

---

## 1. Context

Current stack:
- React + Vite
- TanStack Router + TanStack Query
- tRPC + Fastify backend
- i18n with English/Spanish support

Current priority:
- Ship and polish core UX flow before advanced features.

---

## 2. Component Library Options (Beyond shadcn)

## 2.1 Mantine
- Link: https://mantine.dev/
- Pros:
  - Large, practical component set and hooks for dashboard-style apps.
  - Strong forms/tables/modals out of the box.
  - Fast implementation speed for internal/admin UIs.
- Cons:
  - Visual identity can feel generic unless customized.
  - Adds another design system layer if mixed with existing primitives.

## 2.2 Material UI (MUI)
- Link: https://mui.com/material-ui/getting-started/
- Pros:
  - Mature ecosystem and documentation.
  - Broadest component coverage for business apps.
  - Strong data table and enterprise patterns.
- Cons:
  - Material Design defaults can conflict with product visual direction.
  - Bundle/performance and style override complexity can grow.

## 2.3 Chakra UI
- Link: https://www.chakra-ui.com/docs/get-started/installation
- Pros:
  - Good DX and accessibility defaults.
  - Flexible theming and composable primitives.
  - Faster than fully custom systems for clean production UI.
- Cons:
  - Theming and version transitions may require extra discipline.
  - Runtime styling tradeoffs compared to static CSS approaches.

## 2.4 Ant Design
- Link: https://ant.design/
- Pros:
  - Very complete, enterprise-oriented component suite.
  - Excellent for data-dense CRUD apps.
- Cons:
  - Opinionated visual style; significant effort to avoid “Ant look”.
  - Potentially heavy for simpler or more custom visual directions.

## 2.5 Radix Primitives (+ optional Radix Themes)
- Primitives: https://www.radix-ui.com/primitives/docs/overview/introduction
- Themes: https://www.radix-ui.com/themes/docs/overview/getting-started
- Pros:
  - Accessibility-first low-level building blocks.
  - Great long-term base for a custom design system.
- Cons:
  - More assembly work vs batteries-included libraries.
  - Requires clearer internal UI standards to keep consistency.

## 2.6 Headless UI
- Link: https://headlessui.com/
- Pros:
  - Unstyled accessible components with full visual control.
  - Works well with utility-first styling approaches.
- Cons:
  - Less turnkey than Mantine/MUI/Chakra.
  - Requires stronger in-house design system maturity.

---

## 3. Interactive Mockup / Prototype Tooling

## 3.1 Figma
- Link: https://www.figma.com/prototyping/
- Pros:
  - Team standard with strong collaborative workflows.
  - Fast for journey mapping and click-through prototypes.
  - Robust design system/token/component support.
- Cons:
  - Interaction fidelity is limited for advanced runtime-like behavior.

## 3.2 Penpot (Open Source)
- User guide: https://help.penpot.app/user-guide/
- Prototyping: https://help.penpot.app/user-guide/prototyping-testing/prototyping/
- Pros:
  - Open-source and self-host-friendly.
  - Good for teams avoiding vendor lock-in.
- Cons:
  - Smaller ecosystem and fewer plugins than Figma.

## 3.3 Framer
- Link: https://www.framer.com/prototyping/
- Pros:
  - Strong interaction and motion prototyping.
  - Can publish/share interactive artifacts quickly.
- Cons:
  - Tooling can blend design and website-building concerns.
  - Can diverge from app implementation stack.

## 3.4 ProtoPie
- Product: https://www.protopie.io/
- Getting started docs: https://www.protopie.io/learn/docs/introducing-protopie/getting-started
- Pros:
  - High-fidelity interaction simulation for complex flows.
  - Good for near-real behavior prototypes.
- Cons:
  - Extra tool overhead and team onboarding cost.

## 3.5 Storybook (Code-True Mockups)
- Link: https://storybook.js.org/docs
- Pros:
  - Prototypes built from real components.
  - Combines visual docs, states, and interaction testing.
  - Reduces design-implementation drift.
- Cons:
  - Requires component discipline and maintenance effort.

## 3.6 Ladle (Lightweight Storybook Alternative)
- Link: https://ladle.dev/docs/
- Pros:
  - Faster and lighter setup for React component scenarios.
  - Good for quick interactive state demos.
- Cons:
  - Smaller ecosystem and fewer mature integrations/addons.

---

## 4. Recommendation Matrix

For the current phase:
- Component system: keep `shadcn/ui`.
- Product mockups: use Figma for flow-level design communication.
- Code-level interactive states: introduce Storybook selectively when component surface justifies it.

If we revisit component library later:
- Fastest “ship quickly” candidate: Mantine.
- Most control and long-term system quality: Radix primitives with internal design system.

---

## 5. Suggested Future Evaluation (Timeboxed)

Only after core stabilization:
1. 1-day Mantine spike on 2 core screens (`/accounts`, `/expenses`).
2. 1-day Radix-based spike on the same screens.
3. Compare:
  - implementation speed
  - visual fit and theming effort
  - bundle impact
  - accessibility effort
  - maintainability

Decision should be logged in `.planning/research/decision-log-core-ui.md`.

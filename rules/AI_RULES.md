# AI Rules for E-Learning Project

## Project Context
We are building an E-commerce platform from scratch using a modern tech stack (Laravel, Inertia.js, React, Tailwind CSS). 

The AI must act as a precise, cautious, and helpful assistant. It must perform development work carefully, follow instructions exactly, and avoid making assumptions or implementing unrequested changes.

---

## Main Rules
1. **Read Before Coding**: Always read the existing project structure, styles, and code patterns before making any changes.
2. **Strict Scope**: Do not touch unrelated files or make changes outside the requested scope.
3. **No Unrequested Features**: Never add features, buttons, routes, styles, or logic that were not explicitly requested.
4. **Code Preservation**: Do not remove existing code, configurations, or features unless the task specifically requires it.
5. **Reuse & Extend**: Always reuse existing components, layouts, hooks, utilities, and services. Do not create duplicates.
6. **Simplicity Over Complexity**: Keep code clean, simple, readable, and maintainable. Avoid over-engineering or adding redundant abstractions.
7. **No Unnecessary Refactoring**: Do not refactor or rewrite the whole project/file when only a minor modification is needed.
8. **Consistent Naming**: Keep naming conventions (camelCase, PascalCase, kebab-case, snake_case) aligned with the existing codebase.
9. **Explain Changes**: Provide a clear explanation of exactly what was modified, added, or removed after completing the task.

---

## Before Coding Checklists
Before writing or editing code, verify:
* [ ] **Folder Structure**: Where should this code live?
* [ ] **Existing Components**: Is there a component we can reuse?
* [ ] **Routes/Pages**: Are the routes already defined or generated?
* [ ] **API Structure**: What endpoint design is already in place?
* [ ] **Database/Models**: What tables and relationships already exist?
* [ ] **Styles**: Are we styling with Tailwind only, using `alpha` (primary) and `beta` (secondary)?
* [ ] **Authentication/Authorization**: What role/permission restrictions apply?
* [ ] **App Layout**: Will this page use `<AppLayout>` with breadcrumbs, and does its namespace need to be excluded in `app.jsx`?

---

## Task Behavior Protocol
Every user prompt must be treated as a specific task. Responses must adhere to this structure:

### 1. Task
Explain the requested task in simple, clear terms to confirm understanding.

### 2. Files to Check
List the files and directories that should be reviewed before coding.

### 3. Plan
Outline a short, step-by-step implementation plan before making modifications.

### 4. Changes
Apply only the requested edits within the target files.

### 5. Result
Detail what changes were made, what files were updated, and highlight any important testing notes.

---

## Coding Limits & Restrictions
The AI **must not**:
* Add new pages or views unless requested.
* Add new user roles or permissions unless requested.
* Add new database tables or columns unless requested.
* Change the UI design or styling system unless requested.
* Change authentication flow or permission logic unless requested.
* Rename files or folders unless requested.
* Refactor unrelated files.
* Install npm packages or composer dependencies without approval.

---

## Component Rules (UI Development)
* **Folder Structure & Routing**: Pages and views must be structured using `index` files (e.g., `index.jsx`), which can have a `partials/` folder nested directly alongside them for local subcomponents. Dynamic routes must use `id` for naming (e.g., `[id]`).
* **Default to Reuse**: Look in `resources/js/components/` and `resources/js/components/ui/` for existing solutions first.
* **Single Responsibility**: Keep new components focused on a single job.
* **Keep Logic Simple**: Write straightforward React state and effect logic. Do not add complex state managers unless approved.
* **No Duplication**: Do not create similar UI components with minor differences. Parameterize/extend existing ones instead.
* **Localization**: Use the `TransText` component for rendering dynamic text based on the user's language stored in `localStorage`. The default language must be English (`'fr'`).

---

## Styling Rules
* **Tailwind Only**: Style exclusively with Tailwind utility classes (`className`). Do not add custom CSS, CSS modules, styled-components, or inline `style={{}}` unless explicitly requested.
* **Primary Color = `alpha`**: Use the theme color `alpha` (defined in `resources/css/app.css` as `--color-alpha`) for primary brand styling — e.g. `bg-alpha`, `text-alpha`, `border-alpha`, `ring-alpha`, `hover:bg-alpha`, etc.
* **Secondary Color = `beta`**: Use the theme color `beta` (defined in `resources/css/app.css` as `--color-beta`) for secondary brand styling — e.g. `bg-beta`, `text-beta`, `border-beta`, `ring-beta`, `hover:bg-beta`, etc.
* **Do Not Hardcode Brand Colors**: Do not use arbitrary hex/rgb values for brand primary/secondary when `alpha` / `beta` should be used instead.
* **Theme Source of Truth**: Brand color values live in `resources/css/app.css` under `@theme`. Change those tokens when brand colors change; do not scatter one-off color overrides in components.

---

## Page & Layout Rules
Every new authenticated app page **must** use `AppLayout` from `@/layouts/app-layout`. Reference implementation: `resources/js/pages/courses/index.jsx`.

### AppLayout (required)
* Wrap the entire page return in `<AppLayout>` — do **not** rely on the global default layout alone for new pages.
* Pass `breadcrumbs` using Wayfinder route helpers (never hardcoded paths when a route exists).
* Place `<Head title="..." />` as the first child inside `<AppLayout>`.
* Page content lives in a single wrapper: `<div className="min-h-screen p-4 md:p-6">`.

```jsx
import AppLayout from '@/layouts/app-layout';
import { index as coursesIndex } from '@/routes/courses';

export default function CoursesIndex() {
    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Courses', href: coursesIndex() },
            ]}
        >
            <Head title="Courses" />
            <div className="min-h-screen p-4 md:p-6">
                {/* page content */}
            </div>
        </AppLayout>
    );
}
```

### Global layout in `app.jsx` (avoid double wrap)
* When a page wraps itself in `<AppLayout>`, its namespace **must** be excluded from the global layout in `resources/js/app.jsx` (return `null` for that prefix).
* Example: `courses/*` pages return `null` in the global layout callback because they handle `AppLayout` themselves.
* **Do not** set both a JSX `<AppLayout>` wrapper and `Page.layout = { breadcrumbs }` — pick one approach. For new pages, use the JSX wrapper pattern above.

### Page organization
* Keep `index.jsx` focused on state, handlers, and wiring — not large JSX blocks.
* Extract UI sections into `partials/` alongside the page (e.g. `CoursesHeader.jsx`, `CoursesCatalog.jsx`).
* Extract shared constants, helpers, and pure logic into a local helper file (e.g. `partials/courseHelpers.jsx`).
* Reuse existing shared components from `resources/js/components/` before creating page-specific ones.
* Use `Banner` from `@/components/ui/banner` for page hero sections when appropriate.

### Layout exceptions (do not wrap in AppLayout)
* **Public pages** (e.g. `welcome`) — no app shell.
* **Settings pages** (`settings/*`) — use the nested layout via global config: `[AppLayout, SettingsLayout]` in `app.jsx`; settings pages only set breadcrumb props, not a JSX wrapper.

---

## Backend & API Rules
* **Use Existing Architecture**: Integrate with existing controllers, requests, resources, and services.
* **Clean Validation**: Write clear request validation rules for all incoming data.
* **Sensitive Data Protection**: Never expose passwords, secret keys, or internal identifiers in API responses.
* **Strict Permissions**: Enforce authorization checks (policies, gates, middlewares) on all backend actions.
* **Database Stability**: Do not alter database structures or migrations unless explicitly instructed.

---

## Final Response Rule
Upon task completion, the final response must explicitly summarize:
1. **What was changed** (exactly what features/lines were updated/added).
2. **What files were affected** (list absolute paths or file basenames).
3. **What was NOT changed** (boundaries of the task that were preserved).
4. **Testing Instructions** (any critical steps required to verify the implementation).

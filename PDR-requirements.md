# Flagdeck — Product Requirements (PDR Spec)

**Document purpose:** Requirements baseline for Preliminary Design Review (PDR).  
**Product:** Multi-brand feature flag and brand configuration management platform  
**Audience:** Product, engineering, design, stakeholders  

---

## 1. Overview

### 1.1 Problem

Whitelabel rail apps share one product codebase across multiple brands. Feature availability and brand-specific runtime config differ by brand and environment (Stage vs Production). Today those settings are hard to inspect, change safely, and audit.

### 1.2 Solution

**Flagdeck** is a single-page web application that lets authorised users:

- Manage a global catalogue of feature flags and their on/off state per brand and environment
- Manage nested brand runtime configuration (timeouts, document URLs, webchat, smartcard copy, best-fare-finder settings, warnings)
- Stage flag-state changes, review a publish summary, then apply them
- Invite users and assign roles with enforced permissions
- Inspect an audit trail and revert a brand’s flag configuration to a prior snapshot (with a diff preview)

### 1.3 Goals

| Goal | Description |
|------|-------------|
| Safety | Production changes are restricted by role; flag toggles are published via an explicit review step |
| Consistency | Flags are global; state varies only by brand × environment |
| Traceability | Material changes are audited; flag config history supports revert |
| Operational fit | Config shape aligns with the existing brand API payload (`config`, `features`, `warnings`) |

### 1.4 Non-goals (current scope)

- Live integration with a production config/feature API (Flagdeck persists its own D1 store today)
- Per-brand flag catalogues (flags are shared across all brands)
- Automated Stage → Production bulk copy UI (removed from product; operators publish Production toggles individually via the draft/publish flow)
- SSO / corporate identity provider beyond Google Workspace for `@ontrackretail.co.uk`
- Real-time multi-user collaboration / conflict resolution

---

## 2. Users & roles

### 2.1 Roles

| Role | Capabilities |
|------|----------------|
| **Developer** | Create/edit flag metadata; create flags; edit **Stage** flag state; edit **Stage** brand config; cannot edit Production; cannot manage users; cannot delete flags; cannot revert history |
| **Admin** | Everything a Developer can do, plus edit **Production** flag state and **Production** brand config; cannot manage users; cannot delete flags; cannot revert history |
| **Owner** | Full access: users, flag create/edit/delete/deprecate, Stage & Production flag state, Stage & Production config, history revert |

### 2.2 Role rules

- Permissions are enforced in the UI (controls hidden or disabled when disallowed).
- A user cannot change their own role (control disabled for their own account).
- Users are invited by email and assigned exactly one role: Developer, Admin, or Owner.

### 2.3 Sign-in

Users sign in with **Google** only. The Google account email must be `@ontrackretail.co.uk` and must already exist in the Flagdeck user roster (invited by an Owner).

---

## 3. Brands & environments

### 3.1 Brands (fixed catalogue)

All brands share the same flag set and config schema:

1. Southeastern  
2. Transpennine  
3. Southern  
4. Gatwick  
5. Great Northern  
6. Thameslink  
7. Ticketyboo  

### 3.2 Environments

- **Stage**
- **Production**

Flag on/off state and brand config are stored independently for every brand × environment combination.

---

## 4. Feature flags

### 4.1 Data model

A feature flag is **global** (one definition for all brands).

| Field | Description |
|-------|-------------|
| Name | Stable key (e.g. `enableCardPayments`) |
| Description | Human-readable summary |
| Tags | Location / domain labels (e.g. payments, tickets, accessibility) |
| Status | `Active` or `Deprecated` |
| States | Boolean on/off for each brand × environment |

**Defaults:** New flags are created for **all brands** and **both environments**, defaulted **OFF**.

### 4.2 Status vs state

- **Status** (`Active` / `Deprecated`) is metadata about whether the flag is still used in newer app versions.
- **State** (on/off) is the runtime value per brand × environment.
- These are independent.

### 4.3 Deprecated flags

- Remain visible for reference when “Show deprecated” is enabled.
- Are visually distinguished.
- Are hidden from the main list by default.

### 4.4 Lifecycle rules

| Action | Rule |
|--------|------|
| Create | Developers and above. Creates the flag everywhere (all brands, Stage + Production), default OFF. Tags selectable from existing tags or newly created. |
| Edit metadata | Developers and above (name, description, tags). |
| Deprecate / reactivate | Developers and above. |
| Delete | **Owner only**. Permanent; removes the flag from all brands and environments. Requires confirmation. |
| Toggle state | Role-gated by environment (Stage: Developer+; Production: Admin+). Changes are **staged**, not applied immediately. |

### 4.5 Draft & publish (flag state)

Flag on/off changes use a draft → publish workflow:

1. User toggles Stage/Production controls; UI reflects the intended value and marks unpublished changes.
2. A **Publish changes** call-to-action appears with a count of pending changes (and Discard).
3. Publish opens a **summary** of every pending change: flag, brand, environment, before → after.
4. User confirms; changes are applied atomically to live state, written to the audit trail, and brand history snapshots are recorded for affected brands.
5. Toggling a control back to the published value removes that entry from the draft.

Stage and Production controls are visually differentiated (e.g. colour coding) so environments are not confused.

### 4.6 Main flags view

- List Active flags (optional include Deprecated).
- Each row: name, description, tags, status.
- Expandable per-flag brand grid with Stage and Production toggles for all seven brands (respecting role).
- Search: matches words against name, description, **and** tags.
- Tag filter: select one or more tags (AND semantics).
- Add flag action for Developers and above.

### 4.7 Alignment with brand API `features`

The platform’s flag catalogue is intended to mirror the boolean `features` map returned by the brand configuration API (example: Southeastern Stage payload). Seed / import behaviour may load those keys as flags, with per-brand Stage/Production values managed in Flagdeck.

---

## 5. Brand configuration

### 5.1 Purpose

Manage the nested **`config`** object (and **`warnings`**) from the brand runtime API, independently of boolean feature flags.

### 5.2 Scope of editable config

Per brand × environment:

| Section | Fields (representative) |
|---------|-------------------------|
| API timeouts | `apiTimeoutInMilliseconds`, `apiJPJourneyPlanTimeoutInMilliseconds` |
| Documents | Accessibility PDF/leaflet URLs, rolling stock URL, priority seat info URL |
| Magazine | `title`, `description`, `url`, `imageUrl`, `srTitle` |
| Webchat | `url` |
| Smartcard | `warningAtScanning` (HTML-capable string) |
| Best fare finder | `defaultNumberOfResults`, `defaultNLC` |
| Warnings | Ordered list of warning strings |

### 5.3 Config view behaviour

- Select brand and environment.
- Edit fields in a structured form matching the API schema.
- Save is role-gated: Stage editable by Developer+; Production by Admin+.
- Saves are recorded in the audit trail (`config_update`).

### 5.4 Relationship to flags

| API field | Managed as |
|-----------|------------|
| `features.*` | Feature flags (Flags view) |
| `config.*` | Brand config (Config view) |
| `warnings` | Brand config (Config view) |

---

## 6. Users administration

- View roster of users (email + role).
- Owners can invite by email and assign a role.
- Owners can change another user’s role or remove them.
- Non-owners can view the roster but cannot mutate users.

---

## 7. Audit trail

### 7.1 Events recorded

At minimum:

- Flag create, edit, delete
- Flag status change (Active / Deprecated)
- Flag toggle publish (on/off, with brand & environment)
- Brand config update
- Config / flag-history revert
- User add, role change, user remove

### 7.2 Entry contents

- Who (user email / id)
- When (timestamp)
- Action type and summary
- Brand and environment when relevant
- Flag identity when relevant
- Before → after values where applicable

### 7.3 Audit view

- Sorted newest first
- Filterable by user, brand, flag, and action type

---

## 8. History & revert

### 8.1 Snapshots

- On published flag-state changes (and other mutating flag operations that affect brand state), the system stores a per-brand configuration snapshot with timestamp, actor, and label.
- Snapshots capture flag on/off state for that brand (Stage and Production).

### 8.2 History view

- Filter by brand.
- List prior snapshots with timestamp, label, actor, and flag count.
- Owners can initiate revert; other roles may browse.

### 8.3 Revert UX

1. User selects a snapshot.
2. System shows a **diff preview**: every Stage/Production value that would change (current → restored), labelled by flag and environment.
3. If nothing would change, revert is disabled.
4. User confirms; restore is applied, audited, and a new snapshot is recorded.

---

## 9. Information architecture

| Area | Purpose |
|------|---------|
| Flags | Catalogue, search/filter, draft toggles, publish |
| Config | Brand × environment runtime config & warnings |
| Users | Invite and role management |
| Audit | Filterable change log |
| History | Per-brand snapshots and revert with preview |

---

## 10. Technical requirements (current implementation baseline)

| Concern | Requirement |
|---------|-------------|
| Client | Single-page React application (Vite) |
| Backend | Cloudflare Worker API (`/api/*`) with D1 as source of truth |
| Auth | Google OAuth only; email must be `@ontrackretail.co.uk` and invited |
| Auth (session) | HttpOnly signed cookie; permissions enforced in the Worker |
| Draft toggles | Pending flag changes remain client-side until Publish |
| Branding of UI | Clear Stage vs Production visual distinction in flag controls |

### 10.1 Future production considerations (for PDR discussion)

- Import/sync from live Stage/Production brand config endpoints
- Export of Flagdeck state to the `config` / `features` / `warnings` API shape
- Approval workflows / dual control for Production
- Retention policies for audit and history

---

## 11. Acceptance criteria (summary)

1. All seven brands and both environments are represented for every flag.
2. Creating a flag never creates Stage-only presence; Production always exists (default OFF).
3. Developers cannot mutate Production flag state or Production config.
4. Admins cannot manage users, delete flags, or revert history.
5. Owners can perform all privileged actions.
6. Flag toggles do not apply until Publish is confirmed from a change summary.
7. Deprecated flags are excluded from the default list and visually marked when shown.
8. Search matches name, description, and tags; tag filters narrow the list.
9. Config UI can represent and edit the nested API config schema and warnings per brand/env.
10. Audit log captures material changes with actor, time, and before/after where relevant.
11. Revert shows a diff of what will change before confirmation.

---

## 12. Open questions for PDR

1. Should brand config edits share the same draft/publish workflow as flag toggles?
2. Should history snapshots include config + warnings, or remain flag-state only?
3. What is the source of truth once a backend exists—Flagdeck, or the brand config service?
4. Should Production publishes require a second approver?
5. How should new feature keys discovered in an environment’s API be onboarded (auto-import vs manual create)?

---

## Document control

| Field | Value |
|-------|--------|
| Product name | Flagdeck |
| Spec type | PDR requirements |
| Based on | Platform behaviour as of current prototype + original feature-flagging brief |
| Related artefact | Example Stage API payload (`APiexample.json`) for Southeastern |

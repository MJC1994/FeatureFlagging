Build a feature flag management web app for a multi-brand (whitelabel) product.

TECH: Single-page web app. Use React + a lightweight in-memory/JSON store.
Persist state to localStorage so it survives refresh. [Change this line if you
have a preferred stack/backend.]

BRANDS (fixed list, all share the same set of flags):
Southeastern, Transpennine, Southern, Gatwick, Great Northern, Thameslink, Ticketyboo

USERS & ROLES:
- An area to add/invite new users by email. Each user is assigned one role:
  Developer, Admin, or Owner.
- Owner: full access to everything (manage users, create/edit/delete/deprecate
  flags, edit Stage and Production state for all brands, revert history).
- Admin: can edit the state of Production feature flags (and Stage), for all
  brands. Cannot manage users.
- Developer: can create feature flags and edit Stage state. Cannot edit
  Production state and cannot manage users.
- Enforce these permissions in the UI: hide or disable controls a user's role
  is not allowed to use.
- A user cannot change their own role (the control is disabled for their own
  account).

CORE DATA MODEL:
- A feature flag is global: it exists once and applies to every brand.
- Each flag has: name, description, location tags (screen/area it affects), and
  a status of Active or Deprecated.
- Deprecated flags are historical flags no longer used in newer app versions.
  They stay visible for reference but are visually distinguished and, by default,
  filtered out of the main list (toggle to show them).
- State is stored PER brand and PER environment. Environments: Stage, Production.
- Every flag/brand/environment combination has an on/off value. Default is OFF.

RULES:
- Adding a new flag creates it for ALL brands, in BOTH environments, defaulted OFF.
- You cannot add a flag to only Stage — adding to Stage always adds it to
  Production too. Flags always exist everywhere; only the on/off value varies.
- Toggling any flag on or off (for a given brand + environment) requires a
  confirmation dialog stating brand, environment, flag name, and direction.
- Marking a flag Active/Deprecated is a status change, separate from its on/off
  values.
- Deleting a flag is permanent and removes it from all brands and environments.
  Only the Owner role can delete a flag, and deletion requires confirmation.

COPY STAGE TO PRODUCTION:
- A "Copy Stage to Production" action (per brand), available to roles that can
  edit Production.
- It opens a modal listing every flag whose Production value would change to
  match its Stage value, showing the before → after for each.
- Each change is selected by default; the user can deselect any changes they
  don't want to apply.
- Applying the selected changes is a single confirmed action.

AUDIT TRAIL:
- Record an audit entry for every change: flag create, edit, delete, status
  change (Active/Deprecated), on/off toggle, Stage→Production copy, config
  revert, and user/role changes.
- Each entry records: who (user), when (timestamp), what changed, the affected
  brand and environment where relevant, and the before → after values.
- Provide an audit log view that is filterable (by user, brand, flag, and
  action type) and sorted newest first.

HISTORY & REVERT:
- Save a snapshot of each brand's flag configuration on every change.
- History view per brand showing previous configurations with timestamps.
- Revert a brand to any previous configuration in minimal clicks (pick snapshot +
  one confirm). Revert is a confirmed action and is recorded in the audit trail.

MAIN VIEW:
- A list of all Active feature flags (with a toggle to include Deprecated ones).
  Each row shows name, description, tags, and status.
- For each flag, controls to change its value per brand, with Stage and
  Production toggles for each of the 7 brands (respecting the current user's role).
- Search bar that filters by matching words against tags, name, AND description.
- A separate tag filter (select one or more tags).
- Add-new-flag action (name, description, tags) — Developers and above.

Keep the UI clean and functional. Prioritise correctness of the rules above.
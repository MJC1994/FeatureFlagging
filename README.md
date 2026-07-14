# Flagdeck

Multi-brand feature flag management app built with React + Vite + TypeScript.

State persists to `localStorage`. Seeded with Owner / Admin / Developer accounts so you can switch roles in the sidebar and verify permissions.

## Run

```bash
npm install
npm run dev
```

## Roles

| Role | Create flags | Edit Stage | Edit Production | Manage users | Delete flags | Revert |
|------|--------------|------------|-----------------|--------------|--------------|--------|
| Developer | ✓ | ✓ | | | | |
| Admin | ✓ | ✓ | ✓ | | | |
| Owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

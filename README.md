# Flagdeck

Multi-brand feature flag and brand configuration management app (React + Vite + TypeScript).

State persists to `localStorage`. Seeded with Owner / Admin / Developer accounts so you can switch roles in the sidebar and verify permissions. Feature flags and Southeastern Stage config are seeded from the example API payload.

## Links

- **GitHub:** https://github.com/MJC1994/FeatureFlagging
- **Live:** https://flagdeck.netlify.app

## Run locally

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

import type { View } from '../types';

export interface TourStep {
  /** CSS selector, usually `[data-tour="…"]`. Omit for a centered intro card. */
  target?: string;
  title: string;
  body: string;
  /** Optional demo action run when this step becomes active. */
  demo?: string;
  /** Label for the primary button (default Next / Done). */
  nextLabel?: string;
  /** Demo action to run when primary button is clicked on this step. */
  demoOnNext?: string;
}

export const TOURS: Record<View, TourStep[]> = {
  flags: [
    {
      title: 'Welcome to Flags',
      body: 'This short demo walks you through changing a feature flag and publishing it. You can skip anytime and replay from Welcome demo.',
    },
    {
      target: '[data-tour="acting-as"]',
      title: 'Roles matter',
      body: 'You are acting as an Owner, so you can edit Stage and Production. Switch users later to see how Developers are Stage-only.',
    },
    {
      target: '[data-tour="flags-list"]',
      title: 'Open a flag',
      body: 'We expand a flag so you can see Stage (blue) and Production (green) toggles for every brand.',
      demo: 'expandFlag',
    },
    {
      target: '[data-tour="demo-stage-toggle"]',
      title: 'Change a Stage value',
      body: 'Next flips the Southeastern Stage toggle. The change is staged only — live state is unchanged until you publish.',
      demo: 'prepareToggle',
      demoOnNext: 'toggleStage',
      nextLabel: 'Toggle Stage',
    },
    {
      target: '[data-tour="flags-publish-bar"]',
      title: 'Unpublished changes',
      body: 'The publish bar appears with a count of staged changes. Discard would throw them away; Publish opens the review summary.',
      demo: 'ensurePending',
    },
    {
      target: '[data-tour="flags-publish-btn"]',
      title: 'Review before going live',
      body: 'Next opens the publish summary so you can check flag, brand, environment, and before → after.',
      demoOnNext: 'openPublish',
      nextLabel: 'Open summary',
    },
    {
      target: '[data-tour="publish-summary"]',
      title: 'Confirm the diff',
      body: 'This is what will be applied. Publishing writes the live values, records the audit trail, and saves history snapshots.',
      demo: 'openPublish',
    },
    {
      target: '[data-tour="publish-apply"]',
      title: 'Publish the change',
      body: 'Finish the demo by publishing. After this, check Audit for the entry and History for a new snapshot.',
      demo: 'openPublish',
      demoOnNext: 'publish',
      nextLabel: 'Publish now',
    },
  ],
  config: [
    {
      title: 'Welcome to Config',
      body: 'Manage the nested brand runtime config — timeouts, document URLs, webchat, smartcard copy, best fare finder, and warnings — separately from boolean flags.',
    },
    {
      target: '[data-tour="nav-config"]',
      title: 'Config vs Flags',
      body: 'API `features` live under Flags. API `config` and `warnings` live here, matching your brand payload shape.',
    },
    {
      target: '[data-tour="config-brand"]',
      title: 'Pick a brand',
      body: 'Each of the seven brands has its own Stage and Production config. Southeastern Stage is seeded from the example API response.',
    },
    {
      target: '[data-tour="config-environment"]',
      title: 'Pick an environment',
      body: 'Developers can edit Stage. Admins and Owners can also edit Production. Disallowed environments are view-only.',
    },
    {
      target: '[data-tour="config-form"]',
      title: 'Edit & save',
      body: 'Update sections in the form, then Save config. Saves are written to the audit log for traceability.',
    },
  ],
  users: [
    {
      title: 'Welcome to Users',
      body: 'Invite teammates and assign roles. Permissions control who can touch Production, manage users, delete flags, or revert history.',
    },
    {
      target: '[data-tour="nav-users"]',
      title: 'Who can manage users?',
      body: 'Only Owners can invite, change roles, or remove users. Everyone else can view the roster.',
    },
    {
      target: '[data-tour="users-invite"]',
      title: 'Invite by email',
      body: 'Owners enter an email, choose Developer / Admin / Owner, and invite. You cannot change your own role.',
    },
    {
      target: '[data-tour="users-table"]',
      title: 'Roster & roles',
      body: 'Review who has access. Switch “Acting as” in the sidebar to feel how each role experiences the rest of the app.',
    },
  ],
  audit: [
    {
      title: 'Welcome to Audit',
      body: 'Every material change is recorded — flag publishes, config saves, user updates, and reverts — newest first.',
    },
    {
      target: '[data-tour="nav-audit"]',
      title: 'Why audit matters',
      body: 'Use this log to answer who changed what, when, and on which brand or environment.',
    },
    {
      target: '[data-tour="audit-filters"]',
      title: 'Filter the log',
      body: 'Narrow by user, brand, flag, or action type to investigate a specific change.',
    },
    {
      target: '[data-tour="audit-list"]',
      title: 'Before → after',
      body: 'Each entry includes a summary and, where relevant, the previous and new values.',
    },
  ],
  history: [
    {
      title: 'Welcome to History',
      body: 'Published flag-state changes create per-brand snapshots so you can roll back if something goes wrong.',
    },
    {
      target: '[data-tour="nav-history"]',
      title: 'Snapshots per brand',
      body: 'History is scoped by brand. Pick a brand to see its earlier configurations.',
    },
    {
      target: '[data-tour="history-brand"]',
      title: 'Choose a brand',
      body: 'Filter snapshots for one of the seven brands. Empty lists mean no published changes yet for that brand.',
    },
    {
      target: '[data-tour="history-list"]',
      title: 'Revert with a preview',
      body: 'Owners click Revert to this, review the current → restored diff for Stage and Production, then confirm. The revert is audited.',
    },
  ],
};

export const TOUR_STORAGE_PREFIX = 'flagdeck-tour-seen-v2:';

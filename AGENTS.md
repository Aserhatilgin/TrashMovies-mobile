# TrashMovies - Codex Development Instructions

## Project Overview

TrashMovies is a gamified movie platform where users:

- discover intentionally bad / trash movies
- vote and rate movies
- browse trash movie categories
- play daily movie trivia games
- maintain daily streaks
- track profile statistics and game scores

Read `PROJECT_NOTES.md` before making large architectural changes.

---

# Repository Structure

This repository contains multiple applications.

## Mobile

Location:

mobile/

Stack:

- React Native
- Expo
- Expo Router
- TypeScript
- Redux Toolkit
- Supabase

Main source directory:

mobile/src/

Important directories:

mobile/src/app/
mobile/src/components/
mobile/src/constants/
mobile/src/hooks/
mobile/src/lib/
mobile/src/store/
mobile/src/types/
mobile/src/utils/

---

## Web

Location:

web/

Stack:

- Next.js
- App Router
- TypeScript
- Tailwind CSS
- Supabase

---

# General Development Rules

## TypeScript

Always use TypeScript.

Avoid `any` unless absolutely necessary.

Prefer:

- explicit interfaces
- reusable types
- clear return types for shared functions

Reuse existing types before creating new ones.

---

# Code Quality

Before creating a new:

- component
- hook
- utility
- API function
- type

search the project for an existing implementation first.

Do not duplicate logic.

Prefer small reusable functions and components.

Do not perform unrelated refactors while implementing a feature.

Preserve existing behavior unless the task explicitly requires changing it.

---

# Mobile Rules

All mobile development must stay inside:

mobile/src/

unless configuration changes require otherwise.

## Navigation

Always use Expo Router.

Use:

- router.push
- router.replace
- Link
- Expo Router layouts

Never introduce React Navigation directly.

---

## Colors

NEVER hardcode colors inside components or pages.

Forbidden:

#000
#ffffff
rgb(...)
rgba(...)

Use:

mobile/src/constants/Colors.ts

If a required color does not exist, add it to the theme first.

---

## Translations

NEVER hardcode user-facing strings inside components.

Use:

mobile/src/constants/Translations.ts

All visible text must support the project's translation system.

If new text is needed, add the translation key first.

---

## Components

Page files should focus on:

- layout
- data
- page orchestration

Reusable UI must be extracted into:

mobile/src/components/

Avoid oversized page components.

---

## State Management

Use Redux Toolkit for global application state.

Use local React state only for local UI state such as:

- modal visibility
- input state
- temporary selections

Do not duplicate server/global state unnecessarily.

---

# Supabase

Use the existing Supabase client.

Do not create additional Supabase clients unless explicitly required.

Keep database access functions inside the existing data/API layer.

Do not scatter Supabase queries across UI components.

Prefer:

UI
↓
hook / Redux action
↓
API / service
↓
Supabase

Never expose:

- service_role keys
- database passwords
- private secrets

Do not print secrets in logs.

Do not commit `.env`.

---

# Database Changes

Before changing the database:

1. inspect the existing schema
2. check existing tables and relationships
3. avoid duplicate tables or columns
4. explain destructive changes before performing them

Prefer migrations for schema changes.

Never delete production data unless explicitly instructed.

---

# Authentication

Use Supabase Auth.

Authentication logic should not be duplicated between screens.

Keep authentication state centralized.

Protected screens must correctly handle:

- authenticated users
- logged-out users
- loading auth state

---

# UI / UX

TrashMovies primarily uses a dark visual theme.

Maintain consistency with the existing design system.

Prefer reusable components instead of screen-specific copies.

New screens must work on different phone sizes.

Avoid fixed widths when responsive layouts are possible.

---

# Performance

Avoid unnecessary:

- re-renders
- network requests
- database queries

Use pagination for potentially large datasets.

Do not fetch entire database tables when only a subset is needed.

---

# Dependencies

Before installing a new dependency:

1. check whether the project already has a solution
2. prefer Expo-supported packages for mobile
3. avoid adding large packages for small functionality

Do not replace existing libraries without a strong reason.

---

# Working Style

For small tasks:
- implement directly

For larger tasks affecting multiple systems:
- inspect relevant files first
- provide a short implementation plan
- then implement

Do not guess project architecture when the answer can be found by reading the repository.

---

# Validation

After making changes:

1. check TypeScript errors
2. run lint when available
3. verify imports
4. verify navigation routes
5. verify translation keys
6. verify theme/color usage

Fix errors caused by your changes.

Do not claim a task is complete if validation fails.

---

# Git Safety

Do not:

- reset unrelated changes
- overwrite user work
- force push
- delete branches
- modify unrelated files

Keep changes focused on the requested task.

---

# Definition of Done

A task is complete only when:

- requested behavior is implemented
- TypeScript has no new errors
- imports are valid
- existing architecture is respected
- user-facing text uses translations
- colors use the theme
- no secrets are exposed
- no unrelated behavior was changed

At the end, briefly report:

1. what changed
2. which files changed
3. how it was validated
4. anything that still needs attention
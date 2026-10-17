# Confirmed onboarding test users

Run from `mobile/` with Node.js 24. Copy `.env.auth.example` to `.env.auth.local` and fill in the linked project's URL, project ref, service-role key, and a test-user password. `.env.auth.local` is covered by `.gitignore` and must stay on a trusted developer machine.

```bash
node --env-file=.env.auth.local scripts/auth/create-test-user.ts --email=onboarding-test@example.com --display-name="Onboarding Tester"
```

Omit `--email` to generate a unique `trashmovies-test+…@example.com` address. The password comes only from `TEST_USER_PASSWORD`, so it does not appear in the command line. The script prints the user ID, email, and confirmation state. It creates a confirmed Auth user only: no onboarding completion or preferences are seeded. Sign in normally in the mobile app to run `initialize_user_domain()` and follow the usual routing gate. Real signup and confirmation should be tested separately with a real inbox.

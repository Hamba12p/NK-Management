# NK Udada Hub setup

1. Apply the migrations in order in the Supabase SQL editor: `20260811000000_udada_hub.sql`, then `20260811000001_align_activity_log.sql`.
2. Set the variables listed in `.env.local.example` in a secure local or deployment environment.
3. Run `npm run seed:users` once. It creates/updates the seven roster accounts and a separate emergency administrator.

The shared initial password is never written to the repository. The emergency administrator must use a different password, kept in an external password manager.

The public website currently calls Aminah Yarmah “Volunteer Rep.” The Hub seeds her as Data Protection Officer. Update the public-site copy in a separate website change so the two surfaces do not remain inconsistent.

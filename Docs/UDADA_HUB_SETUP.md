# NK Udada Hub setup

1. Apply the migrations in order in the Supabase SQL editor: `20260811000000_udada_hub.sql`, then `20260811000001_align_activity_log.sql`.
2. Set the variables listed in `.env.local.example` in a secure local or deployment environment.
3. Run `npm run seed:users` once. It creates/updates the seven roster accounts and a separate emergency administrator.

The shared volunteer account uses `ginanina400@gmail.com`. Provisioning migrates the earlier `volunteers@the-nkfoundation.org` account in place, preserving its user ID and existing password. The seed command also provisions the dedicated M&E/Board Advisor account from `NK_ME_BOARD_EMAIL` and `NK_ME_BOARD_PASSWORD`.

The `NK_MASTER_ADMIN_EMAIL` can use `NK_ME_BOARD_PASSWORD` as a board-only alias. That login creates a session for the dedicated board-advisor account, so it cannot access administrator-only areas and is unaffected when the administrator changes their personal password in Settings. The board account's own email and password can also be used directly.

The shared initial password is never written to the repository. The emergency administrator must use a different password, kept in an external password manager.

The public website currently calls Aminah Yarmah “Volunteer Rep.” The Hub seeds her as Data Protection Officer. Update the public-site copy in a separate website change so the two surfaces do not remain inconsistent.

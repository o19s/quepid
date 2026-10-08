# Not doing

Deliberate decisions to leave something as it is, with the reasoning, so they are not re-raised as defects. Delete an entry if the reasoning stops holding.

## Admin user JSON export includes the password digest

**Location:** `app/views/admin/users/index.json.jbuilder`, `app/controllers/admin/users_controller.rb` (`password_encrypted`)

`GET /admin/users.json` returns each user's stored bcrypt digest (`:password`) unless `@shallow` is set. This is intentional: commit `88961911` ("Support api based migration of data between Quepid's", 2023-09-20) added it, together with the `password_encrypted` parameter on admin create/update, so an administrator can move accounts between Quepid instances without forcing everyone to reset their password.

**Why we aren't changing it:**
- Only administrators can reach it, and an administrator can already set any user's password.
- The value is a bcrypt digest, not plaintext.
- Removing it breaks instance-to-instance account migration, and the JSON export is the only path that provides the digest.

**Residual risk:** a digest can be attacked offline if an admin session, response log or export file leaks. Treat exports as sensitive.

**Revisit if:** migration is no longer supported (then remove `:password` from the JSON and the `password_encrypted` handling together), or if a stricter option is wanted, such as an explicit opt-in parameter for including the digest.

The HTML user page does not display the digest. Migration only needs the JSON export, so that display was removed.

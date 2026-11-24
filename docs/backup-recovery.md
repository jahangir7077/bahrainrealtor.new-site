# Private database and media backups

These scripts are deliberately pinned to project ref
`tiojcfemilttggcuqycq` and URL
`https://tiojcfemilttggcuqycq.supabase.co`. They do not accept a URL override.
They never run migrations, change the hosted project, or perform a hosted
restore. Do not run them until the owner has approved the required backup
access and retention arrangements.

## What is backed up

- `database.mjs` runs `pg_dump` in PostgreSQL custom format and streams the
  archive directly into GPG symmetric AES-256 encryption. Database passwords
  are read only through a protected PostgreSQL service file and `.pgpass`.
- `media.mjs` lists and downloads objects from the `private-media` Storage
  bucket through the fixed HTTPS Storage API, then streams a tar archive
  directly through GPG symmetric AES-256 encryption. It uses
  `SUPABASE_SERVICE_ROLE_KEY` only in the API `apikey` and
  `Authorization: Bearer` headers. The key is not accepted as a command-line
  argument or saved by the script.
- Media export accepts only the current
  `UUID/UUID/UUID.(jpg|png|webp)` object layout. Its fixed safeguards are
  10,000 files, 8 MiB per file, 20 GiB total, no more than three attempts per
  Storage request, 30 seconds per request, and two hours total runtime. A limit
  or API failure aborts and removes the incomplete encrypted output; it does
  not skip files.

Both outputs are created outside the repository in a directory set to mode
`0700`, with output files mode `0600`. The scripts do not create plaintext
backup archives. Keep the GPG passphrase separately and securely; losing it
makes the archive unrecoverable. Do not put backups, credentials, or the
passphrase in the repository. During a run, the encrypted stream is written
to a `.partial` file and linked to its final name only after a successful
finish. If the process is forcibly terminated, a `.partial` may remain; it is
encrypted but incomplete and must not be treated as a backup.

## Prepare local PostgreSQL configuration

Install the PostgreSQL client tools (`pg_dump` and `pg_restore`) and GnuPG
locally. Provide a trusted PostgreSQL root CA certificate so
`sslmode=verify-full` can verify the Supabase database TLS connection. If
using libpq's default CA location, install it as
`$HOME/.postgresql/root.crt` with owner-only permissions.
Create a private configuration directory outside the repository, for example
`$HOME/.config/bahrainrealtor-backup`, with mode `0700`. Create these files
with a local text editor (do not put a password into a shell command or
environment variable):

`$HOME/.config/bahrainrealtor-backup/pg_service.conf`:

```ini
[bahrainrealtor_backup]
host=db.tiojcfemilttggcuqycq.supabase.co
port=5432
dbname=postgres
user=postgres
sslmode=verify-full
```

`$HOME/.config/bahrainrealtor-backup/pgpass` should contain the one matching
PostgreSQL password entry, in libpq's `hostname:port:database:username:password`
format. Escape a literal `:` or `\` in the password as required by
`.pgpass` syntax. Restrict both files to owner read/write (`0600`) and keep
their parent directory private (`0700`). On Unix:

```sh
chmod 700 "$HOME/.config/bahrainrealtor-backup"
chmod 600 "$HOME/.config/bahrainrealtor-backup/pg_service.conf"
chmod 600 "$HOME/.config/bahrainrealtor-backup/pgpass"
```

The script rejects service-file connection overrides, wrong project host,
non-verify-full TLS, missing files, and group/world-readable config. It removes
inherited `PG*` environment settings so they cannot override the validated
service. It does not print file contents or PostgreSQL tool diagnostics.

## Create backups

Choose a destination outside the repository with sufficient free disk space.
The output directory must be an absolute path and must be owned by your user.
For example:

```sh
mkdir -p "$HOME/private-backups/bahrainrealtor"
export PGSERVICEFILE="$HOME/.config/bahrainrealtor-backup/pg_service.conf"
export PGPASSFILE="$HOME/.config/bahrainrealtor-backup/pgpass"
node scripts/backup/database.mjs tiojcfemilttggcuqycq "$HOME/private-backups/bahrainrealtor"
```

Run the database command in a terminal where GPG can request a passphrase
through its configured pinentry. Enter a strong unique passphrase and store it
in an approved password manager. The script writes a `.dump.gpg` file only
after a successful encrypted stream.

The media command requires a service-role key provided to the process
environment by an approved local secret manager. Do not paste the key into a
command, script, `.env` file, or this repository. For example, use the
secret manager's documented process-environment injection, then run:

```sh
node scripts/backup/media.mjs tiojcfemilttggcuqycq "$HOME/private-backups/bahrainrealtor"
```

Unset the service-role key as soon as the command exits. Check that the
encrypted files exist, have restrictive permissions, and can be listed by
GPG without decrypting them. Store a second encrypted copy separately from
the application host and test recovery periodically.

## Isolated local database restore only

The restore script refuses anything except a local service named
`bahrainrealtor_restore` whose host is literally `localhost`, `127.0.0.1`, or
`::1` and resolves only to loopback. It requires the destination database to
be named `bahrainrealtor_restore` with TLS disabled. Do not edit the script to
permit a hosted hostname. Use a disposable, isolated local PostgreSQL instance
and create this empty database before restoring. Never point it at the
production project or a shared database.

Add a local-only service section to the same protected service file:

```ini
[bahrainrealtor_restore]
host=127.0.0.1
port=54322
dbname=bahrainrealtor_restore
user=postgres
sslmode=disable
```

Use the local instance's credentials in the protected `.pgpass` file only.
For a local Supabase CLI instance, use its local database port/password and
add local `.pgpass` entries for the `postgres` maintenance database and
`bahrainrealtor_restore` database. Verify the local instance is running, then
create the dedicated database with an explicitly loopback-only connection:

```sh
PGPASSFILE="$HOME/.config/bahrainrealtor-backup/pgpass" \
  createdb --host=127.0.0.1 --port=54322 --username=postgres bahrainrealtor_restore
```

Use the local instance's actual port if it differs from `54322`. The restore uses
`pg_restore --single-transaction`, does not drop or create databases, and
does not use a destructive `--clean` option. It streams GPG decryption to
`pg_restore` without creating a plaintext dump file.

Run the restore with explicit paths:

```sh
export PGSERVICEFILE="$HOME/.config/bahrainrealtor-backup/pg_service.conf"
export PGPASSFILE="$HOME/.config/bahrainrealtor-backup/pgpass"
node scripts/backup/restore-local.mjs tiojcfemilttggcuqycq \
  "$HOME/private-backups/bahrainrealtor/database-<timestamp>.dump.gpg"
```

Enter the archive's GPG passphrase through pinentry. The script also requires
the archive file to be owned by you and mode `0600`. It strips inherited
`PG*` overrides and validates the local service before starting either
process. Restore only into the intentionally disposable local database.

## Recovery limitations

These are data exports, not a complete Supabase project image. The database
dump does not capture project settings, API keys, Auth configuration,
functions, secrets, provider-managed state, or deployment configuration.
Supabase Auth users, identities, sessions, and internal `auth` schema state
are not a supported recovery target for this procedure. Do not treat a
successful local SQL restore as proof that hosted Auth can be reconstructed.

The media archive contains original object bytes and a path/size manifest; it
does not recreate Storage bucket settings, policies, or Supabase-managed
object metadata. It is not automatically imported on restore. Recreating
Storage objects requires a separately reviewed, local-only procedure that
preserves the database/object-path relationship. No script here restores
objects or writes to hosted Supabase.

# Quepid Docker Deploy

The `docker-compose.yml` template creates a MySQL instance, a Ollama instance, and the Quepid application.

Data is persisted between restarts in the `./volumes` sub directories.


1. Update `docker-compose.yml` to use the version of quepid (like `o19s/quepid:8.2.0`) that you want to run.

2. Create the Quepid database the first time by uncommenting `bin/rake db:setup` in `entrypoint.sh`.

3. Start Quepid: `docker compose up`

4. Go to http://localhost and register

5. Grant your user admin permissions via: `docker compose exec app bundle exec thor user:grant_administrator EMAIL`

6. Comment out the call to `bin/rake db:setup` in `entrypoint.sh` after creating the database the first time.

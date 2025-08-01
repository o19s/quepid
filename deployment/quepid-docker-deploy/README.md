# Quepid Docker Deploy

The `docker-compose.yml` template creates a MySQL instance, a Ollama instance, and the Quepid application.

Data is persisted between restarts in the `./volumes` sub directories.


1. Update `docker-compose.yml` to use the version of quepid (like `o19s/quepid:8.2.0`) that you want to run.  See https://hub.docker.com/r/o19s/quepid/tags.

2. Start Quepid: `docker compose up`, append `-d` to have it run as a background process.

4. Go to http://localhost and register your user

5. Grant your user admin permissions via: `docker compose exec app bundle exec thor user:grant_administrator EMAIL`

To stop Quepid run `docker compose down`.

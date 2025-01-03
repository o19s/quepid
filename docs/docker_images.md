Images for the main app are maintained on Docker Hub.  To push a new build:

- Login: `docker login` (Requires access to the quepid account)
- Push: `docker compose push`

To tag specific versions add a tag in the docker-compose file, to get started we're defaulting to latest.

# Jupyterlite

We package up Jupyterlite notebooks to work with Quepid via the https://github.com/o19s/quepid-jupyterlite repository.

For development we have a `bin/setup_jupyterlite` script that grabs the release and dumps it locally.   

For prod, we bake the files in as part of building the image.

On Heroku, we grab the version and deploy it.   The version is specified in `app.json`.

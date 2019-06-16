# Deployment Instructions
To get started you need Docker images for the application.  Is is possible to build your own images using the latest code, or fetch prebuilt images from DockerHub.  Both methods are outlined below.

## Building Your Own Image
To prepare your own images: run `bin/setup_docker.sh`.  This script will:

- Use docker-compose to fetch and build all images required for the application
- Setup the database for Quepid

This process can take upwards of 20 minutes

## Using Prebuilt Images
To utilize prebuilt images from docker.io run `bin/setup_docker.sh nobuild`.

## Setup test users
To create an admin user and other test users, run the following script:

`bin/docker r bin/rake db:seed:test`

__Note:__ This is currently the only way to setup an Admin user.  You can signup within the app to make new users.

## Running the Application
After you've run `setup_docker.sh` you can launch the application with the following commands:

- Start the containers: `bin/docker start`
- Run the App server within the container: `bin/docker daemon`

__Note:__ If you're interested in seeing request logs, `bin/docker server` will run everything in the foreground. 

## Done
That's it!  If you run into issues don't hesitate to reach out.

[Quepid Slack](http://www.opensourceconnections.com/slack)

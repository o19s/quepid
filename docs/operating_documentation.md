# Operating Documentation

This document explains how Quepid can be operated and configured.   You may also want to look at the [How-To Guides](https://quepid-docs.dev.o19s.com/2/quepid) as well.

- [Installing Quepid](#installing-quepid)
- [Running behind a load balancer](#running-behind-a-load-balancer)
- [Setting up a Context Path](#setting-up-a-context-path)
- [Mail](#mail)
- [OAuth](#OAuth)
- [Managing Websocket Load](#managing-websocket-load)
- [Legal Pages & GDPR](#legal-pages-&-gdpr)
- [User Tracking](#user-tracking)
- [Heathcheck Endpoint](#healthcheck)
- [Analytics Settings](#analytics-settings)
- [Troubleshoot Your Deploy](#troubleshoot-your-deploy)
- [Database Management](#database-management)
- [Jupyterlite Notebooks](#jupyterlite-notebooks)
- [Using Personal Access Tokens](#using-personal-access-tokens)
- [Scripting Users Cases Ratings](#scripting-users-cases-ratings)
- [Posting Announcements to Users](#posting-announcements-to-users)
- [ActiveRecord Encryption Setup](#activerecord-encryption-setup)
- [Integrating External Eval Pipeline](#integrating-external-eval-pipeline)

## Installing Quepid

See the documentation and links for installing Quepid via Docker, Heroku, AWS, and Kubernetes at https://github.com/o19s/quepid/wiki/Installation-Guide.

## Running behind a load balancer

> ⚠️ _Quepid will run in TLS (`https`) or plain `http` mode depending on the
> protocol of the target search engine_. Requests to the search engine
> are issued by the client. Most browsers deny plain http requests
> (to the search engine) originating from a TLS secured Quepid.

(1) To run behind a TLS secured load balancer, acquire a valid TLS certificate
from e.g. [Let's Encrypt](https://letsencrypt.org/) or create a self-signed
certificate:

```bash
# create self-signed certificate
$ openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -subj "localhost" \
    -keyout /etc/ssl/certs/quepid.key \
    -out /etc/ssl/certs/quepid.crt

# join private key and certificate into PEM format
$ cat /etc/ssl/certs/quepid.crt /etc/ssl/certs/quepid.key \
    > /etc/ssl/certs/quepid.pem
```

(2) Configure your favorite load balancer (or reverse proxy), in this
case [Nginx](http://nginx.org/)

```nginx
server {
    listen              80;
    listen              443 ssl;
    ssl_certificate     /etc/ssl/certs/quepid.pem;
    ssl_certificate_key /etc/ssl/certs/quepid.pem;
    ssl_protocols       TLSv1.2;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    access_log off;

    location / {
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_pass http://localhost:3000/;
    }
}
```

(3) Configure Quepid with the domain visible to the user.

```
QUEPID_DOMAIN=https://localhost  # Set this to the domain visible to the user
FORCE_SSL=true                   # Enable this to use https only connections
PREFER_SSL=true                  # Enable this to have URLs for the main application (not the core case app) be in https mode.
```

> ⚠️ Setting `FORCE_SSL=true` will prevent you from testing search engines
> that are not TLS enabled (`https`)!  You typically want either FORCE_SSL or PREFER_SSL.

## Setting up a Context Path

If you wish to host Quepid in a folder other than the root folder (`/`), specify the `RAILS_RELATIVE_URL_ROOT` env var.

__Note 1:__ The context path should not have a trailing-slash.  If you do not wish to setup a context path you can leave this variable blank.

__Note 2:__ The precompiled assets also need to know about the RAILS_RELATIVE_URL_ROOT in the production docker image.   Add to your `entrypoint.sh` the instruction `RAILS_ENV=production bundle exec rake assets:precompile RAILS_RELATIVE_URL_ROOT=/quepid-app` to redo the image.


## Mail

Quepid has to send E-Mails for several reasons, for example for the password reset function or to invite a new user.
Therefore Quepid has two options to use:

- [Postmark](#postmark) ([https://postmarkapp.com/](https://postmarkapp.com/)) (default)
- [SMTP](#smtp)

The behavior which option should used, can be controlled by the following `ENV` var:
```
EMAIL_PROVIDER  # set to "smtp" to use SMTP, "postmark" to use Postmark, or blank to disable sending emails.
```

Set the from email address via the following `ENV` var:
```
EMAIL_SENDER                 # The from email address.  i.e quepid@o19s.com
```

## Postmark

If you want to use Postmark as your mail delivery service, you have to set the `EMAIL_PROVIDER` to `postmark` and you have to tell Quepid your [Server API Token](https://postmarkapp.com/support/article/1008-what-are-the-account-and-server-api-tokens). This can be done by setting the following `ENV` var:

```
POSTMARK_API_TOKEN=XXXXXXXXXXXX  # Your Postmark Server API Token
```

## SMTP

If you want to use STMP for sending mails, you have to set the `EMAIL_PROVIDER` to `smtp` and set the following `ENV` vars to describe the connection to the smtp sever:

```
SMTP_HOST                    # smtp server to use for sending
SMTP_PORT                    # smtp port to use for connection
MAIL_DOMAIN                  # If you need to specify a HELO domain, you can do set it here
SMTP_USERNAME                # If your mail server requires authentication, set the username in this setting
SMTP_PASSWORD                # If your mail server requires authentication, set the password in this setting
SMTP_AUTHENTICATION_TYPE     # If your mail server requires authentication, you need to specify the authentication type here (plain, login, cram_md5)
SMTP_ENABLE_STARTTLS         # If STARTTLS is enabled in your server set to true
```

## OAuth
Quepid uses [OmniAuth](https://github.com/intridea/omniauth) for authenticating users against other resources besides it's own email/password database.   OmniAuth provides an easy way to authenticate against dozens of outside services. The only ones that are packaged with Quepid are Google and Keycloak, but it's fairly easy to add new ones.

Learn more about setting up Google oAuth at https://support.google.com/cloud/answer/6158849?hl=en.

The built in options are `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KEYCLOAK_REALM` and `KEYCLOAK_SITE`.

The OmniAuth providers are defined in `config/initializers/devise.rb`. A list of available providers can be viewed on the [OmniAuth Wiki](https://github.com/intridea/omniauth/wiki/List-of-Strategies). To enable a provider you need to add the gem (eg. `omniauth-facebook`) to the `Gemfile` and configure in `devise.rb` and `user.rb`

The existence of `GOOGLE_CLIENT_ID` or `KEYCLOAK_REALM` enables the respective sign in option.

### Keycloak Setup Details

Quepid has a basic Keycloak config file in `/keycloak/realm-config/quepid-realm.json` that is used for development purposes.

We have a Realm called `Quepid`, and it includes a Client called `quepid`.  The client is where the specific configuration for how Quepid interacts with Keycloak via oAuth is set up.

We *assume* that the client definition in Keycloak will be named `quepid`, you can't change that.  You can pick your Realm name however.

Keycloak 17+ removes the `/auth` portion of the url.  If you are using earlier versions of keycloak, you need to set `base_url:'/auth'` in devise.rb.

## Managing Websocket Load

Quepid uses [SolidCable]() to back the websocket messaging that drives some asynchrnous communication. The state is managed in the database.

By default we issue a query every tenth of a second, which can overload your database.

Set `SOLID_CABLE_POLLING` to `1.seconds` or even `5.seconds` to change how often updates are checked for.  The default is `0.1.seconds`.


## Legal Pages & GDPR

If you would like to have legal pages linked in the footer of the app, similar to behavior on http://go.quepidapp.com,
add the following `ENV` vars:

```
TC_URL      # terms and condition
PRIVACY_URL # privacy policy
COOKIES_URL # cookies policy
```

Quepid ships with a default cookie policy page available via `COOKIES_URL=/cookies`.

To comply with GDPR, and be a good citizen, the hosted version of Quepid asks if they are willing to receive Quepid related updates via email.  This feature isn't useful to private installs, so this controls the display.

```
EMAIL_MARKETING_MODE=true   # Enables a checkbox on user signup to consent to emails
```

## User Tracking

We currently only support Google Analytics, and you enable it by setting the following `ENV` var:

```
QUEPID_GA=XXXXXXXXXXXX  # Your Google Analytics Key
```


## Healthcheck

Want to monitor if Quepid is behaving?  Just monitor `/healthcheck`, and you will get 200 status codes from a healthy Quepid, and 503 if not.  The JSON output is `{"code":200,"status":{"database":"OK","migrations":"OK"}}`.

## Troubleshoot Your Deploy

When errors occur, Quepid logs them and shows a generic page.  
However sometimes getting to those logs is difficult, and you just want the message immediately.

You can enable this behavior by setting the follow `ENV` var:

```
QUEPID_CONSIDER_ALL_REQUESTS_LOCAL=true
```

Confirm the setup by visiting `/api/test_exception` which raises an error and will give you the debugging page "RuntimeError in Api::ApiController#test_exception".

## Database Management

See the details in [](./database.md).

## Jupuyterlite Notebooks

See the details in [](./jupyterlite.md).

## Using Personal Access Tokens

Accessing the Quepid API like http://localhost:3000/api/cases/5.json is protected by you logging in and having the appropriate cookies set. But what if we want to have an automated process?   Then you need to create a Personal Access Token.  Using that, you can then do a curl request like:

```
curl -X GET -H 'Authorization: Bearer 53e41835979d649775243ababd4312e8' http://localhost:3000/api/cases/5.json
>> {"name":"Book of Ratings","book_id":1,"query_doc_pairs":[{"query_doc_pair_id":1,"position":1,"query":"adsf","doc_id":"asdf","judgements":[]}]}%
```
Here is an example of creating a query doc pair:

```
curl -X POST http://localhost:3000/api/books/2/query_doc_pairs/ -H 'Authorization: Bearer 4a82040bf1b2d255c63833cb59fa9275' -H 'Content-Type: application/json' -d '{
  "query_doc_pair": {
    "document_fields": "{title:My Document}",
    "query_text": "my search",
    "doc_id": "some_special_doc_id_52",
    "position": 1
  }
}'
```

```
curl -X POST http://localhost:3000/api/books/2/judgements/ -H 'Authorization: Bearer 4a82040bf1b2d255c63833cb59fa9275' -H 'Content-Type: application/json' -d '{
  "judgement": {
    "query_doc_pair_id": 201
    "rating": 1
  }
}'
```

## Scripting Users Cases Ratings

The see available tasks:

```
docker compose run app bundle exec thor list
```

Examples include:

```
case
----
thor case:create NAME ...      # creates a new case
thor case:share CASEID TEAMID  # shares case with an team

ratings
-------
thor ratings:generate SOLRURL FILENAME  # generates random ratings into a .csv file
thor ratings:import CASEID FILENAME     # imports ratings to a case

user
----
thor user:create EMAIL USERNAME PASSWORD    # creates a new user
thor user:grant_administrator EMAIL         # grant administrator privileges to user
thor user:reset_password EMAIL NEWPASSWORD  # resets user's password
```

To see more details about any of the tasks, run `bin/docker r bundle exec thor help TASKNAME`:

```
thor help user:create
Usage:
  thor user:create EMAIL USERNAME PASSWORD

Options:
  -a, [--administrator], [--no-administrator]

Description:
  `user:create` creates a new user with the passed in email, name and password.

  EXAMPLES:

  $ thor user:create foo@example.com "Eric Pugh" mysuperstrongpassword

  With -a option, will mark the user as Administrator

  EXAMPLES:

  $ thor user:create -a admin@example.com Administrator mysuperstrongpassword
```

## Posting Announcements to Users

Sometimes you need to communicate to your users, like the fact that a scorer has been changed or a end point updated.  You can publish a new announcement to all users via the Admin's Announcements page.  You can use emojis and html in this, like this:

```
🎉 The program for <img src="https://haystackconf.com/img/logo.png" width="178" height="27"> has been launched!
```

Once they see it, they won't see it again.

## ActiveRecord Encryption Setup

Quepid uses ActiveRecord encryption to protect sensitive data like LLM API keys. For details on how to set up and configure encryption for your Quepid installation, see [ENCRYPTION_SETUP.md](./ENCRYPTION_SETUP.md).

## Integrating External Eval Pipeline

If you have an external evaluation pipeline, you can easily post the results of that pipeline into Quepid using the API.  See [./examples/external_eval](https://github.com/o19s/quepid/tree/main/docs/examples/external_eval) for a simple Python script that demonstrates storing Scores for a Case that are calculated externally.

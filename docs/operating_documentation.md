# Operating Documentation

This document explains how Quepid can be operated and configured.

- [Running behind a load balancer](#loadbalancer)
- [Mail](#mail)
- [OAuth](#OAuth)
- [Legal Pages & GDPR](#legal-pages-&-gdpr)
- [User Tracking](#user-tracking)
- [Heathcheck Endpoint](#healthcheck)
- [Database Management](#database-management)

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
```

> ⚠️ Setting `FORCE_SSL=true` will prevent you from testing search engines
> that are not TLS enabled (`https`)!

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



## Legal Pages & GDPR

If you would like to have legal pages linked in the footer of the app, similar to behavior on http://app.quepid.com,
add the following `ENV` vars:

```
TC_URL      # terms and condition
PRIVACY_URL # privacy policy
COOKIES_URL # cookies policy
```

To comply with GDPR, and be a good citizen, the hosted version of Quepid asks if they are willing to receive Quepid related updates via email.  This feature isn't useful to private installs, so this controls the display.

```
EMAIL_MARKETING_MODE=true   # Enables a checkbox on user signup to consent to emails
```

## User Tracking

We currently only support Google Analytics, and you enable it by setting the following `ENV` var:

```
QUEPID_GA=XXXXXXXXXXXX  # Your Google Analytics Key
```

You will need Redis to support sending events to GA.   In production, uncomment the Redis
configuration in `docker-compose.yml` to set up a local Redis.  Also uncomment the `worker` in
the file `Procfile`


## Healthcheck

Want to monitor if Quepid is behaving?  Just monitor `/healthcheck`, and you will get 200 status codes from a healthy Quepid, and 503 if not.  The JSON output is `{"code":200,"status":{"database":"OK","migrations":"OK"}}`.

## Database Management

See the details in [](./database.md).

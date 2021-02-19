# Operating Documentation

This document explains how Quepid can be operated and configured.

# Table of Contents

- [Mail](#mail)
  - [I. Postmark](#postmark)
  - [II. SMTP](#smtp)
- [Legal Pages & GDPR](#legal-pages-&-gdpr)

# Mail

Quepid has to send E-Mails for several reasons, for example for the password reset function or to invite a new user.
Therefore Quepid has two options to use:

- [Postmark](#postmark) ([https://postmarkapp.com/](https://postmarkapp.com/)) (default)
- [SMTP](#smtp)

The behavior which option should used, can be controlled by the following `ENV` var:
```
EMAIL_PROVIDER  # set to "smtp" to use SMTP, "postmark" to use Postmark, or blank to disable sending emails.
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


# Legal Pages & GDPR

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

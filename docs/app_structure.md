# App Structure

This document explains how the app is organized.

## Backend

The backend is written in Ruby using the Ruby on Rails framework.

Most of the backend is comprised of API endpoints for the exception of the admin area and user account or password management section.

The admin section contains a few pages for admins to manage users and default scorers.

The user account and password section are a few pages for the user to set or reset their own password and update their own info.

The API endpoints all live under the `app/controllers/api` folder. The API is versioned, even though there's only one version at the moment: `V1`.

## Frontend

The frontend is written using AngularJS (currently on version 1.7.7). And the  way it is organized is a bit messy due to some parts of the app being legacy code (over 5 years old).

The first place to look would be inside of the `app/assets/javascripts/components` directory. That directory has a bunch of sub-directories, each representing a component.

A component is comprised of a controller file typically ending with `_controller.js`, a directive file typically ending with `_directive.js` and a template file typically ending with `.html`. Some components may have multiple controllers and templates, especially the ones that have a modal associated with it.

If what you're looking for isn't a component (we haven't been able to refactor the entire frontend into components yet), it is then probably setup as a controller in `app/assets/javascripts/controllers` and an HTML template in `app/assets/templates`.

The AngularJS app starts with the `app/assets/javascripts/app.js` file and the `app/assets/javascripts/routes.js` file.

The main entry to the app is through a case page, which is controller by the `app/assets/javascripts/controllers/mainCtrl.js` controller.

This is the basic structure of the app and should get you started.

## Permissions Structure

We currently have a mix of hard coded rules and the use of the Pundit gem.  For example, this code from `scorers_controller.rb`:

```
unless @scorer.owner == current_user or (@scorer.communal and policy(@scorer).update_communal?)
  render(
    json:   {
      error: 'Cannot edit a scorer you do not own',
    },
    status: :forbidden
  )

  return
end
```

We should be able to just use the `authorize()` and `policy()` methods from Pundit.

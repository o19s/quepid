# Admin Scorer Editing

> **Note:** This document describes completed functionality. Implementation details have been moved to [archives/port_completed.md](archives/port_completed.md#completed-admin-scorer-editing-2026-02-19).

## Overview

Administrators manage communal scorers directly through the main Scorers interface at `/scorers`. This unified approach provides a single location for managing all scorers (both custom and communal), eliminating the need for a separate admin interface.

## What are Communal Scorers?

Communal scorers are scoring algorithms that ship with Quepid and are available to all users. Examples include:
- AP@10 (Average Precision at 10)
- nDCG@10 (Normalized Discounted Cumulative Gain at 10)
- P@10 (Precision at 10)
- And other standard information retrieval metrics

These scorers are marked with `communal: true` in the database and typically don't have an owner (`owner_id: nil`).

## Admin Capabilities

### View Communal Scorers

All users can view communal scorers in the scorers list at `/scorers`. Use the "Communal" filter button to show only communal scorers. They display "Communal" in the Type column and "System" as the owner.

### Edit Communal Scorers (Admin Only)

Administrators can:
1. Click the edit icon (pencil) next to a communal scorer in the scorers list
2. Modify the scorer's:
   - Name
   - Code (JavaScript scoring logic)
   - Scale (rating scale)
   - Scale labels
3. Save changes that will affect all users

**Warning**: When editing a communal scorer, a warning alert is displayed: "You are editing a communal scorer that is available to all users. Changes will affect everyone using this scorer."

### Delete Communal Scorers (Admin Only)

Administrators can delete communal scorers from the edit page using the "Delete" button in the top-right toolbar.

Note: The delete button is on the edit page, not in the list view. The list view for communal scorers only shows edit (admin) and clone (all users) actions.

### Test Communal Scorers (Admin Only)

Administrators can test communal scorers using the test endpoint (`POST /scorers/:id/test`). This allows admins to verify scorer code changes before saving. Regular users cannot test communal scorers and will receive a 403 Forbidden response if they attempt to do so.

### Clone Communal Scorers (All Users)

All users can clone communal scorers to create their own custom versions. The cloned scorer will have `communal: false` and be owned by the user who cloned it.

### Creating Communal Scorers

The UI always sets `communal: false` for new scorers. Communal scorers should be created via:

1. **Rails Console**:
   ```ruby
   Scorer.create!(
     name: "My Communal Scorer",
     code: "setScore(calculateScore());",
     communal: true,
     scale: [0, 1, 2, 3]
   )
   ```

2. **Database Seeds** (`db/seeds.rb`):
   ```ruby
   Scorer.find_or_create_by!(name: "nDCG@10") do |scorer|
     scorer.code = "// scoring logic here"
     scorer.communal = true
     scorer.scale = [0, 1, 2, 3]
   end
   ```

### Sharing Communal Scorers

Communal scorers cannot be shared with teams — they are already available to everyone. The share action returns an alert if attempted.

## Features Summary

All functionality for managing communal scorers:

- ✅ View all communal scorers
- ✅ Edit communal scorers (admin only)
- ✅ Delete communal scorers (admin only)
- ✅ Clone communal scorers (all users)
- ✅ Test communal scorers (admin only)
- ✅ Search/filter communal scorers
- ✅ Warning messages when editing communal scorers

## Technical Implementation

### Database Schema

No database changes were required. The `scorers` table remains unchanged with the `communal` boolean field. Communal scorers are identified by `communal: true` and typically have no owner (`owner_id: nil`).

### Controller Implementation

The `ScorersController` uses the `set_scorer` method to control access:

- **Administrators**: Can access all scorers (communal and custom) via `Scorer.for_user(current_user).find(params[:id])`
- **Regular users**: Can only access custom scorers via `Scorer.for_user(current_user).where(communal: false).find(params[:id])`
- Regular users attempting to access communal scorers receive an `ActiveRecord::RecordNotFound` exception

The controller includes authorization checks in `update`, `destroy`, and `test` methods to prevent non-admins from modifying communal scorers.

#### `set_scorer` Method
```ruby
def set_scorer
  @scorer = if current_user.administrator?
              Scorer.for_user(current_user).find(params[:id])
            else
              Scorer.for_user(current_user).where(communal: false).find(params[:id])
            end
end
```

#### `update` Method
```ruby
def update
  if @scorer.communal? && !current_user.administrator?
    redirect_to scorers_path, alert: 'You cannot edit communal scorers.'
    return
  end
  # ... rest of update logic
end
```

#### `destroy` Method
```ruby
def destroy
  if @scorer.communal? && !current_user.administrator?
    redirect_to scorers_path, alert: 'You cannot delete communal scorers.'
    return
  end
  # ... rest of destroy logic
end
```

#### `test` Method
```ruby
def test
  if @scorer.communal? && !current_user.administrator?
    render json: { error: 'You cannot test communal scorers.' }, status: :forbidden
    return
  end
  # ... rest of test logic
end
```

### View Implementation

The scorer edit page (`app/views/scorers/edit.html.erb`) displays a warning alert when an administrator edits a communal scorer:

```erb
<% if @scorer.communal? && current_user.administrator? %>
  <div class="alert alert-warning" role="alert">
    <i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>
    <strong>Warning:</strong> You are editing a communal scorer that is available to all users. 
    Changes will affect everyone using this scorer.
  </div>
<% end %>
```

The scorer form (`app/views/scorers/_form.html.erb`) also displays an informational alert for communal scorers.

The `_list.html.erb` partial conditionally shows admin actions:

```erb
<% if scorer.communal? %>
  <div class="d-inline-flex align-items-center">
    <% if current_user.administrator? %>
      <%= link_to edit_scorer_path(scorer), class: 'btn btn-link p-0 me-2', title: 'Edit' do %>
        <i class="bi bi-pencil" aria-hidden="true"></i>
      <% end %>
    <% end %>
    <%= button_to clone_scorer_path(scorer), method: :post, class: 'btn btn-link p-0 me-2', title: 'Clone' do %>
      <i class="bi bi-files" aria-hidden="true"></i>
    <% end %>
  </div>
<% end %>
```

### API Endpoints

The API endpoints for scorers (`/api/v1/scorers`) include admin checks for communal scorer editing:

```ruby
def update
  unless @scorer.owner == current_user || (@scorer.communal && current_user.administrator?)
    render(
      json: { error: 'Cannot edit a scorer you do not own' },
      status: :forbidden
    )
    return
  end
  # ... rest of update logic
end
```

- Regular users receive a 403 Forbidden response when attempting to update communal scorers
- Administrators can update communal scorers through the API
- The `communal_scorers_only` configuration setting is respected

### Test Coverage

Comprehensive tests in `test/controllers/scorers_controller_test.rb` cover admin functionality for communal scorers, including:

- Admin access to edit/update/delete communal scorers
- Regular user restrictions (RecordNotFound exceptions)
- Test endpoint functionality for admins vs regular users
- Clone functionality for communal scorers
- Sharing restrictions (communal scorers cannot be shared/unshared)

## Security Considerations

1. **Authorization**: Only users with `administrator: true` can edit or delete communal scorers
2. **Regular Users**: Cannot edit communal scorers through the UI or API
3. **Creation**: Regular users cannot create communal scorers (the `communal` flag is always set to `false` for user-created scorers)
4. **Access Control**: Regular users attempting to access communal scorers receive `ActiveRecord::RecordNotFound` exceptions

## Best Practices

1. **Test Before Deploying**: Always test changes to communal scorers in a development environment first
2. **Document Changes**: Keep track of what was changed and why
3. **Notify Users**: Consider notifying users when making significant changes to popular scorers
4. **Backup**: Before deleting a communal scorer, consider creating a backup or documenting the code
5. **Use Clone Feature**: When experimenting with scorer modifications, clone the scorer first to test changes

## Historical Context

### Previous Implementation

Previously, Quepid had a dedicated Admin Communal Scorers interface at `/admin/communal_scorers` with its own controller (`Admin::CommunalScorersController`), views, and routes. This separate interface was removed to:

1. **Unified Interface**: Single location for managing all scorers (both custom and communal)
2. **Better User Experience**: Admins don't need to switch between different interfaces
3. **Consistency**: Uses the same UI patterns as custom scorers
4. **Less Code to Maintain**: Removed duplicate controller and view code

### Migration Path

**Before**: Admins accessed communal scorers via:
- Admin dropdown menu → "Communal Scorers"
- Direct URL: `/admin/communal_scorers`

**After**: Admins access communal scorers via:
- Main navigation → "Scorers" or direct URL: `/scorers`
- Filter by "Communal" type using the filter buttons
- Edit and delete communal scorers directly in the list

### What Was Removed

- Controller: `app/controllers/admin/communal_scorers_controller.rb`
- Views: `app/views/admin/communal_scorers/` (index, show, new, edit, form)
- Tests: `test/controllers/admin/communal_scorers_controller_test.rb`
- Routes: `resources :communal_scorers` from the `admin` namespace
- Navigation links from admin home page and headers

### Rollback Instructions

If you need to rollback this change, you can restore the files from git history:

```bash
# Find the commit that removed the files
git log --all --full-history -- "app/controllers/admin/communal_scorers_controller.rb"

# Restore from that commit (replace COMMIT_HASH)
git checkout COMMIT_HASH^ -- app/controllers/admin/communal_scorers_controller.rb
git checkout COMMIT_HASH^ -- app/views/admin/communal_scorers
git checkout COMMIT_HASH^ -- test/controllers/admin/communal_scorers_controller_test.rb

# Restore the routes and navigation links manually
```

## Related Documentation

- [Managing Scorers](https://quepid-docs.dev.o19s.com/2/quepid/47/managing-scorers)
- [Data Model](./data_mapping.md) - Understanding the scorer data model
- [Application Structure](./app_structure.md) - Overall application architecture

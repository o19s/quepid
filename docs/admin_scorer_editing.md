# Admin Scorer Editing

> **Migration docs:** Older branch snapshots sometimes mention a `POST scorers/:id/test` action; that route is **not** part of the current app—use edit/save and API updates instead. For why the dedicated admin communal UI went away, see [Admin Communal Scorers Removal](./admin_communal_scorers_removal.md).

## Overview

Administrators in Quepid have special privileges to edit and delete communal scorers. This feature allows admins to maintain and update the system-wide scorers that are available to all users.

## What are Communal Scorers?

Communal scorers are scoring algorithms that ship with Quepid and are available to all users. Examples include:
- AP@10 (Average Precision at 10)
- nDCG@10 (Normalized Discounted Cumulative Gain at 10)
- P@10 (Precision at 10)
- And other standard information retrieval metrics

These scorers are marked with `communal: true` in the database and typically don't have an owner.

## Admin Capabilities

### View Communal Scorers
All users can view communal scorers in the scorers list at `scorers#index`. Use the **Communal** filter to show only communal scorers; the **Type** column shows “Communal” and **Owner** shows “System” for those rows.

### Edit Communal Scorers (Admin Only)
Administrators can:
1. Click the edit icon (pencil) next to a communal scorer in the scorers list
2. Modify the scorer's:
   - Name
   - Code (JavaScript scoring logic)
   - Scale (rating scale)
   - Scale labels
3. Save changes that will affect all users

**Warning**: When editing a communal scorer, the edit form shows an alert that changes affect all users.

### Delete Communal Scorers (Admin Only)
Administrators delete a communal scorer from the **scorer edit** page: open the scorer with the pencil icon on the list, then use the **Delete** button in the toolbar and confirm. Communal rows on the list show **edit** and **clone** only (no inline delete).

**Caution**: Deleting a communal scorer will remove it from all users' available scorers. This action should be performed carefully.

### Clone Communal Scorers (All Users)
All users can clone a communal scorer to create a custom copy (`communal: false`, owned by the cloner).

### Creating Communal Scorers
The create form always sets `communal: false`. New communal scorers are created via **Rails console** or **seeds**—see [Creating communal scorers](./admin_communal_scorers_removal.md#creating-communal-scorers) in the removal notes.

### Sharing
Communal scorers are already available to everyone; the list UI only shows **share** for custom scorers. If `ScorersController#share` or `#unshare` is hit for a communal scorer (e.g. crafted request), the user is redirected to the scorers index with: *Communal scorers are already available to everyone.*

## UI Indicators

### Scorers List
- **Regular Users**: Clone for communal scorers; no share control on communal rows
- **Administrators**: Edit and clone for communal scorers (delete is on the edit page)

### Edit Form
When an administrator edits a communal scorer, they will see:
- A warning alert: you are editing a communal scorer; changes affect everyone using it
- Informational copy in the form that the scorer is communal

## Technical Implementation

### Controller Logic
The `ScorersController` includes the following admin checks:

#### `set_scorer` Method
```ruby
def set_scorer
  if current_user.administrator?
    @scorer = Scorer.for_user(current_user).find(params[:id])
  else
    @scorer = Scorer.for_user(current_user).where(communal: false).find(params[:id])
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

### View Logic
The `_list.html.erb` partial shows communal rows with **edit** (admins only) and **clone** (all users); delete is not on the list. See `app/views/scorers/edit.html.erb` for the **Delete** button on the edit screen.

```erb
<% if scorer.communal? %>
  <div class="d-inline-flex align-items-center">
    <% if current_user.administrator? %>
      <%= link_to edit_scorer_path(scorer), class: 'btn btn-link p-0 me-2', title: 'Edit', 'aria-label': 'Edit' do %>
        <i class="bi bi-pencil" aria-hidden="true"></i>
      <% end %>
    <% end %>
    <%= button_to clone_scorer_path(scorer), method: :post, class: 'btn btn-link p-0 me-2', title: 'Clone', 'aria-label': 'Clone' do %>
      <i class="bi bi-files" aria-hidden="true"></i>
    <% end %>
  </div>
<% end %>
```

## Security Considerations

1. **Authorization**: Only users with `administrator: true` can edit or delete communal scorers
2. **Regular Users**: Cannot edit communal scorers through the UI or API; loading a communal scorer by id for edit/update/destroy raises **`ActiveRecord::RecordNotFound`** via `set_scorer` for non-admins
3. **Creation**: Regular users cannot create communal scorers (the `communal` flag is always set to `false` for user-created scorers)

## API Compatibility

The API endpoint (`/api/v1/scorers`) already includes admin checks for communal scorer editing:

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

## Best Practices

1. **Test Before Deploying**: Always test changes to communal scorers in a development environment first
2. **Document Changes**: Keep track of what was changed and why
3. **Notify Users**: Consider notifying users when making significant changes to popular scorers
4. **Backup**: Before deleting a communal scorer, consider creating a backup or documenting the code
5. **Use Clone Feature**: When experimenting with scorer modifications, clone the scorer first to test changes

## Related Documentation

- [Managing Scorers](https://quepid-docs.dev.o19s.com/2/quepid/47/managing-scorers)
- [Admin Communal Scorers Removal](./admin_communal_scorers_removal.md)
- [Data Model](./data_mapping.md)
- [Application Structure](./app_structure.md)
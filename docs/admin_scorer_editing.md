# Admin Scorer Editing

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
All users can view communal scorers in the scorers list at `/scorers`. Communal scorers are marked as "System scorer" in the interface.

### Edit Communal Scorers (Admin Only)
Administrators can:
1. Click the edit icon (pencil) next to a communal scorer in the scorers list
2. Modify the scorer's:
   - Name
   - Code (JavaScript scoring logic)
   - Scale (rating scale)
   - Scale labels
3. Save changes that will affect all users

**Warning**: When editing a communal scorer, admins will see a warning banner indicating that changes will affect all users.

### Delete Communal Scorers (Admin Only)
Administrators can delete communal scorers by:
1. Clicking the delete icon (X) next to a communal scorer
2. Confirming the deletion in the prompt

**Caution**: Deleting a communal scorer will remove it from all users' available scorers. This action should be performed carefully.

## UI Indicators

### Scorers List
- **Regular Users**: See a clone button and "System scorer" label for communal scorers
- **Administrators**: See edit, clone, and delete buttons for communal scorers

### Edit Form
When an administrator edits a communal scorer, they will see:
- A warning banner at the top: "Warning: You are editing a communal scorer that is available to all users. Changes will affect everyone using this scorer."
- An info alert within the form: "This is a communal scorer available to all Quepid users."

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
The `_list.html.erb` partial conditionally shows admin actions:

```erb
<% if scorer.communal? %>
  <div class="d-inline-flex align-items-center">
    <% if current_user.administrator? %>
      <%= link_to edit_scorer_path(scorer), class: 'btn btn-link p-0 me-2' do %>
        <i class="bi bi-pencil" aria-hidden="true"></i>
      <% end %>
    <% end %>
    <!-- Clone button for all users -->
    <% if current_user.administrator? %>
      <%= button_to scorer_path(scorer), method: :delete, class: 'btn btn-link text-danger p-0 me-2' do %>
        <i class="bi bi-x-circle" aria-hidden="true"></i>
      <% end %>
    <% end %>
    <span class="text-muted small">System scorer</span>
  </div>
<% end %>
```

## Security Considerations

1. **Authorization**: Only users with `administrator: true` can edit or delete communal scorers
2. **Regular Users**: Cannot edit communal scorers through the UI or API
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
- [Data Model](./data_mapping.md)
- [Application Structure](./app_structure.md)
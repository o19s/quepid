# Admin Scorer Editing

## Overview

With the removal of the dedicated Admin Communal Scorers interface (see [admin_communal_scorers_removal.md](./admin_communal_scorers_removal.md)), administrators now manage communal scorers directly through the main Scorers interface at `/scorers`. This document describes how that admin functionality works.

## What are Communal Scorers?

Communal scorers are scoring algorithms that ship with Quepid and are available to all users. Examples include:
- AP@10 (Average Precision at 10)
- nDCG@10 (Normalized Discounted Cumulative Gain at 10)
- P@10 (Precision at 10)
- And other standard information retrieval metrics

These scorers are marked with `communal: true` in the database and typically don't have an owner.

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

### Delete Communal Scorers (Admin Only)
Administrators can delete communal scorers from the edit page using the "Delete" button in the top-right toolbar.

Note: The delete button is on the edit page, not in the list view. The list view for communal scorers only shows edit (admin) and clone (all users) actions.

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

## Technical Implementation

### Controller Logic
The `ScorersController` includes the following admin checks:

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

### View Logic
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
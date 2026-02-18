# Admin Communal Scorers Removal - Migration Notes

## Overview

The Admin Communal Scorers interface has been removed from Quepid. Communal scorers can now be managed directly from the main Scorers interface (`/scorers`) by administrators.

## What Was Removed

### Controller
- `app/controllers/admin/communal_scorers_controller.rb` - Dedicated admin controller for communal scorers

### Views
- `app/views/admin/communal_scorers/` - All admin communal scorer views:
  - `_form.html.erb`
  - `edit.html.erb`
  - `index.html.erb`
  - `new.html.erb`
  - `show.html.erb`

### Tests
- `test/controllers/admin/communal_scorers_controller_test.rb` - All admin communal scorer tests

### Routes
- Removed `resources :communal_scorers` from the `admin` namespace

### Navigation Links
Removed links to admin communal scorers from:
- `app/views/admin/home/index.html.erb` - Admin home page
- `app/views/layouts/_header.html.erb` - Main header navigation
- `app/views/layouts/_header_core_app.html.erb` - Core app header navigation

## Why Was It Removed?

The separate admin interface for communal scorers was redundant. Administrators can now manage communal scorers more efficiently through the main Scorers interface with the following benefits:

1. **Unified Interface**: Single location for managing all scorers (both custom and communal)
2. **Better User Experience**: Admins don't need to switch between different interfaces
3. **Consistency**: Uses the same UI patterns as custom scorers
4. **Less Code to Maintain**: Removed duplicate controller and view code

## Migration Path

### For Administrators

**Before**: Admins accessed communal scorers via:
- Admin dropdown menu → "Communal Scorers"
- Direct URL: `/admin/communal_scorers`

**After**: Admins access communal scorers via:
- Main navigation → "Scorers" or direct URL: `/scorers`
- Filter by "Communal" type using the filter buttons
- Edit and delete communal scorers directly in the list

### Functional Changes

| Action | Old Way | New Way |
|--------|---------|---------|
| **View communal scorers** | `/admin/communal_scorers` | `/scorers` (filter by "Communal") |
| **Create communal scorer** | Admin interface only | Not supported via UI — see [admin_scorer_editing.md](admin_scorer_editing.md) for console/seeds |
| **Edit communal scorer** | `/admin/communal_scorers/:id/edit` | `/scorers/:id/edit` (admin only) |
| **Delete communal scorer** | Admin interface | `/scorers` list (admin only) |

### Creating Communal Scorers

Not supported via UI. See [admin_scorer_editing.md](admin_scorer_editing.md) for Rails console and seeds examples.

## Features Maintained

All functionality for managing communal scorers has been maintained:

- ✅ View all communal scorers
- ✅ Edit communal scorers (admin only)
- ✅ Delete communal scorers (admin only)
- ✅ Clone communal scorers (all users)
- ✅ Search/filter communal scorers
- ✅ Warning messages when editing communal scorers

## Related Documentation

- [Admin Scorer Editing](./admin_scorer_editing.md) - Details on new admin scorer management
- [Data Model](./data_mapping.md) - Understanding the scorer data model
- [Application Structure](./app_structure.md) - Overall application architecture

## Technical Notes

### Database Schema

No database changes were required. The `scorers` table remains unchanged with the `communal` boolean field.

### API Endpoints

The API endpoints for scorers (`/api/v1/scorers`) were not affected and continue to work as before with proper admin authorization checks.

### Test Coverage

New comprehensive tests were added to `test/controllers/scorers_controller_test.rb` covering admin functionality for communal scorers.

## Rollback

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

## Questions or Issues?

If you encounter any issues or have questions about this change:

1. Check the [Admin Scorer Editing documentation](./admin_scorer_editing.md)
2. Review the test files for usage examples
3. Contact the development team
# proxy-allowlist Specification

## Purpose

Controls which internal network targets the Quepid proxy may reach. Operators can let it reach their own search engines without exposing the rest of their network to server-side request forgery.

## Requirements

### Requirement: Internal targets are blocked by default
The proxy SHALL refuse a target URL when any address it resolves to is loopback, link-local, private (RFC1918, carrier-grade NAT, IPv6 unique-local) or unspecified, unless an allowlist entry permits it. It SHALL respond with HTTP 400 and `proxy_error: "Proxy URL resolves to a disallowed address"`, and SHALL make no request to the target.

#### Scenario: Private target with no allowlist
- **WHEN** a logged-in user proxies a URL whose host resolves to `10.0.5.20` and no allowlist entry covers it
- **THEN** the response is HTTP 400 with `proxy_error: "Proxy URL resolves to a disallowed address"` and no request reaches `10.0.5.20`

#### Scenario: Public target
- **WHEN** a logged-in user proxies a URL whose host resolves only to public addresses
- **THEN** the request is forwarded

### Requirement: Admin management is off unless enabled
Unless `PROXY_ALLOWLIST_ADMIN_MANAGED` is true, Quepid SHALL NOT offer the proxy allowlist admin page and SHALL ignore any stored entries when deciding proxy requests. Disabling the flag SHALL NOT delete stored entries.

#### Scenario: Flag off hides the page
- **WHEN** the flag is unset or false and an administrator opens the proxy allowlist admin URL
- **THEN** the response is HTTP 404 and the admin sidebar shows no proxy allowlist link

#### Scenario: Flag off ignores stored entries
- **WHEN** a stored entry allows `10.0.5.0/24`, the flag is then set to false and the server restarted, and a user proxies a URL resolving to `10.0.5.20`
- **THEN** the request is refused with HTTP 400

#### Scenario: Re-enabling restores stored entries
- **WHEN** the flag is set back to true and the server restarted
- **THEN** previously stored entries are listed again and take effect

### Requirement: Only administrators manage entries
With the flag on, only Quepid administrators SHALL be able to view, add, edit or remove admin-managed entries.

#### Scenario: Non-administrator is refused
- **WHEN** the flag is on and a non-administrator opens the proxy allowlist admin URL or submits an add, edit or remove
- **THEN** they are redirected with the alert "You must be a Quepid Administrator." and nothing changes

### Requirement: Administrators can add a network entry
With the flag on, an administrator SHALL be able to add a CIDR range or single IP, with an optional note. The entry SHALL apply to the next proxy request without a restart.

#### Scenario: Add a network
- **WHEN** an administrator adds `10.0.5.0/24` with the note "Prod Solr"
- **THEN** the entry appears in the list with its note, and the next proxied request to an address in `10.0.5.0/24` is forwarded without restarting the server

### Requirement: Administrators can add a host entry
With the flag on, an administrator SHALL be able to add an exact hostname, with an optional note. It SHALL then reach private addresses on the next proxy request without a restart, but never loopback, unspecified (`0.0.0.0/8`, `::`) or link-local addresses.

#### Scenario: Add a host
- **WHEN** an administrator adds `search.internal` and `search.internal` resolves to `10.1.2.3`
- **THEN** the next proxied request to `http://search.internal/` is forwarded

#### Scenario: Admin host resolving to loopback
- **WHEN** an administrator has added `search.internal` and it resolves to `127.0.0.1`
- **THEN** a proxied request to `http://search.internal/` is refused with HTTP 400

#### Scenario: Admin host resolving to the unspecified address
- **WHEN** an administrator has added `search.internal` and it resolves to `0.0.0.0`
- **THEN** a proxied request to `http://search.internal/` is refused with HTTP 400

#### Scenario: Admin host resolving to link-local
- **WHEN** an administrator has added `search.internal` and it resolves to `169.254.169.254`
- **THEN** a proxied request to `http://search.internal/` is refused with HTTP 400

### Requirement: Administrators can edit an entry
An administrator SHALL be able to change an admin-managed entry's value and note, but not its kind. An edited value SHALL pass the same validation and limits as a new entry. The change SHALL apply to the next proxy request without a restart.

#### Scenario: Edit a network value
- **WHEN** an administrator edits the stored `10.0.5.0/24` entry to `10.0.6.0/24`
- **THEN** the next proxied request to `10.0.6.20` is forwarded and the next proxied request to `10.0.5.20` is refused with HTTP 400

#### Scenario: Invalid edit is rejected
- **WHEN** an administrator edits the stored `10.0.5.0/24` entry to `10.0.0.0/8`
- **THEN** the form re-renders with a validation message and the stored entry is still `10.0.5.0/24`

#### Scenario: Edit only the note
- **WHEN** an administrator changes only the note of the stored `10.0.5.0/24` entry
- **THEN** the new note is shown and proxy decisions for `10.0.5.0/24` are unchanged

### Requirement: Administrators can remove an entry
An administrator SHALL be able to remove an admin-managed entry. Removal SHALL apply to the next proxy request without a restart.

#### Scenario: Remove a network
- **WHEN** an administrator removes the stored `10.0.5.0/24` entry
- **THEN** the entry no longer appears and the next proxied request to `10.0.5.20` is refused with HTTP 400

### Requirement: Admin network entries cannot cover loopback or link-local
Saving an admin network entry SHALL be refused, with a validation message, if the range overlaps loopback (`127.0.0.0/8`, `::1`), unspecified (`0.0.0.0/8`, `::`) or link-local (`169.254.0.0/16`, `fe80::/10`) addresses.

#### Scenario: Link-local range rejected
- **WHEN** an administrator submits `169.254.169.254`
- **THEN** the form re-renders with a validation message and no entry is saved

#### Scenario: Loopback range rejected
- **WHEN** an administrator submits `127.0.0.1`
- **THEN** the form re-renders with a validation message and no entry is saved

#### Scenario: Unspecified range rejected
- **WHEN** an administrator submits `0.0.0.0/16`
- **THEN** the form re-renders with a validation message and no entry is saved

### Requirement: Admin network entries have a maximum breadth
Saving an admin network entry SHALL be refused, with a validation message, if it is broader than /16 for IPv4 or /48 for IPv6.

#### Scenario: Overly broad IPv4 range rejected
- **WHEN** an administrator submits `10.0.0.0/8`
- **THEN** the form re-renders with a validation message stating the /16 limit and no entry is saved

#### Scenario: Range at the limit accepted
- **WHEN** an administrator submits `10.20.0.0/16`
- **THEN** the entry is saved

### Requirement: Admin entries are validated
An admin entry, whether added or edited, SHALL be refused with a validation message when:
- a network is not a valid CIDR or IP;
- a host is not a plain hostname (wildcards, schemes, ports, paths and bare IPs are refused);
- the same value is already stored.

#### Scenario: Wildcard host rejected
- **WHEN** an administrator submits the host `*.internal`
- **THEN** the form re-renders with a validation message and no entry is saved

#### Scenario: Duplicate rejected
- **WHEN** an administrator submits `10.0.5.0/24` and that network is already stored
- **THEN** the form re-renders with a validation message and no duplicate is saved

### Requirement: Admin changes are attributed
Each admin-managed entry SHALL record and display who added it and when, and who last changed it and when. Every add, edit and remove SHALL be written to the Rails log with the administrator, the action and the value, and an edit's line SHALL include the old and new value.

#### Scenario: Attribution shown and logged
- **WHEN** administrator `admin@example.com` adds `10.0.5.0/24`, and later removes it
- **THEN** while it exists the list shows `admin@example.com` and the creation time, and the Rails log has one line for the add and one for the remove, each naming the administrator and `10.0.5.0/24`

#### Scenario: Edit attribution
- **WHEN** `admin@example.com` added `10.0.5.0/24` and `other@example.com` edits it to `10.0.6.0/24`
- **THEN** the list shows added by `admin@example.com`, last changed by `other@example.com`, and the Rails log has a line naming `other@example.com`, `10.0.5.0/24` and `10.0.6.0/24`

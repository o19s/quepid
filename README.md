
# Quepid

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CircleCI](https://circleci.com/gh/o19s/quepid.svg?style=svg)](https://circleci.com/gh/o19s/quepid)
[![Docker Hub](https://img.shields.io/docker/pulls/o19s/quepid.svg)](https://hub.docker.com/r/o19s/quepid/ "Docker Pulls")
[![Rails Style Guide](https://img.shields.io/badge/code_style-rubocop-brightgreen.svg)](https://github.com/rubocop-hq/rubocop-rails)
[![Slack](https://img.shields.io/badge/slack--channel-blue?logo=slack)](https://www.opensourceconnections.com/slack)

<img src="https://quepidapp.com/images/logo.png" alt="Quepid logo" title="Quepid" align="right" />

**Quepid now lives at https://go.quepidapp.com/, the old domain quepid.com is retired.**

Quepid makes improving your app's search results a repeatable, reliable engineering process that the whole team can understand. It deals with three issues:

1. **Our collaboration stinks** Making holistic progress on search requires deep, cross-functional collaboration. Shooting emails or tracking search requirements in spreadsheets won't cut it.

2. ***Search testing is hard*** Search changes are cross-cutting: most changes will cause problems. Testing is difficult: you can't run hundreds of searches after every relevance change.

3. **Iterations are slow** Moving forward seems impossible. To avoid sliding backwards, progress is slow. Many simply give up on search, depriving users of the means to find critical information.


**To learn more, please check out the [Quepid website](https://www.quepidapp.com) and the [Quepid User Manual](https://quepid-docs.dev.o19s.com/2/quepid).**

**If you are ready to dive right in, you can use the [Hosted Quepid](https://go.quepidapp.com) service right now or follow the [installation steps](https://quepid-docs.dev.o19s.com/2/quepid/61/how-to-deploy-quepid-locally) to set up your own local instance of Quepid.**

# Table of Contents

<!-- MarkdownTOC levels="1,2" autolink=true bracket=round -->

- [Developer Guide](#developer-guide)
- [Data Map](#data-map)
- [App Structure](#app-structure)
- [Operating Documentation](#operating-documentation)
- [🙏 Thank You's](#-thank-yous)

<!-- /MarkdownTOC -->

# Developer Guide

Are you interested in contributing to Quepid or customizing it for your own needs? Check out our [Developer Guide](DEVELOPER_GUIDE.md) for detailed instructions on setting up your development environment, running tests, and debugging.

# Data Map

The [Data Mapping](docs/data_mapping.md) file provides detailed information about the data structure of the app.

You can rebuild the [ERD](docs/erd.png) via `bin/docker r bundle exec rake erd:image`

# App Structure

The [App Structure](docs/app_structure.md) file explains how Quepid is structured and organized.

# Operating Documentation

Refer to the [Operating Documentation](docs/operating_documentation.md) file for information on how Quepid can be operated and configured for your company.

# 🙏 Thank You's

Quepid would not be possible without the contributions from many individuals and organizations.

Specifically we would like to thank Erik Bugge and the folks at Kobler for funding the Only Rated feature released in Quepid [6.4.0](https://github.com/o19s/quepid/releases/tag/v6.4.0).

Quepid wasn't always open source! Check out the [credits](docs/credits.md) for a list of contributors to the project.

If you would like to fund development of a new feature for Quepid do [get in touch](http://www.opensourceconnections.com/contact/)!

[![quepid  contributors](https://contrib.rocks/image?repo=o19s/quepid&max=2000)](https://github.com/o19s/quepid/graphs/contributors)

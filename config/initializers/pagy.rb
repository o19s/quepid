# frozen_string_literal: true

# Pagy initializer file (43.1.8)
# See https://ddnexus.github.io/pagy/resources/initializer/

############ Global Options ################################################################
# See https://ddnexus.github.io/pagy/toolbox/options/ for details.
# Add your global options below. They will be applied globally.

Pagy.options[:limit] = 25

############ JavaScript ####################################################################
# See https://ddnexus.github.io/pagy/resources/javascript/ for details.
# Examples for Rails:
# For apps with an assets pipeline
# Rails.application.config.assets.paths << Pagy::ROOT.join('javascripts')
#
# For apps with a javascript builder (e.g. esbuild, webpack, etc.)
# javascript_dir = Rails.root.join('app/javascript')
# Pagy.sync_javascript(javascript_dir, 'pagy.mjs') if Rails.env.development?

# Countless extra: Paginate without any count, saving one query per rendering
# See https://ddnexus.github.io/pagy/docs/extras/countless
# require 'pagy/extras/countless'
# Pagy::DEFAULT[:countless_minimal] = false   # default (eager loading)

# Elasticsearch Rails extra: Paginate `ElasticsearchRails::Results` objects
# See https://ddnexus.github.io/pagy/docs/extras/elasticsearch_rails
# Default :pagy_search method: change only if you use also
# the searchkick or meilisearch extra that defines the same
# Pagy::DEFAULT[:elasticsearch_rails_pagy_search] = :pagy_search
# Default original :search method called internally to do the actual search
# Pagy::DEFAULT[:elasticsearch_rails_search] = :search
# require 'pagy/extras/elasticsearch_rails'

# Headers extra: http response headers (and other helpers) useful for API pagination
# See https://ddnexus.github.io/pagy/docs/extras/headers
# require 'pagy/extras/headers'
# Pagy::DEFAULT[:headers] = { page: 'Current-Page',
#                            limit: 'Page-Items',
#                            count: 'Total-Count',
#                            pages: 'Total-Pages' }     # default

# Keyset extra: Paginate with the Pagy keyset pagination technique
# See https://ddnexus.github.io/pagy/docs/extras/keyset
# require 'pagy/extras/keyset'

# Meilisearch extra: Paginate `Meilisearch` result objects
# See https://ddnexus.github.io/pagy/docs/extras/meilisearch
# Default :pagy_search method: change only if you use also
# the elasticsearch_rails or searchkick extra that define the same method
# Pagy::DEFAULT[:meilisearch_pagy_search] = :pagy_search
# Default original :search method called internally to do the actual search
# Pagy::DEFAULT[:meilisearch_search] = :ms_search
# require 'pagy/extras/meilisearch'

# Metadata extra: Provides the pagination metadata to Javascript frameworks like Vue.js, react.js, etc.
# See https://ddnexus.github.io/pagy/docs/extras/metadata
# you must require the JS Tools internal extra (BEFORE the metadata extra) ONLY if you need also the :sequels
# require 'pagy/extras/js_tools'
# require 'pagy/extras/metadata'
# For performance reasons, you should explicitly set ONLY the metadata you use in the frontend
# Pagy::DEFAULT[:metadata] = %i[scaffold_url page prev next last]   # example

# Searchkick extra: Paginate `Searchkick::Results` objects
# See https://ddnexus.github.io/pagy/docs/extras/searchkick
# Default :pagy_search method: change only if you use also
# the elasticsearch_rails or meilisearch extra that defines the same
# Pagy::DEFAULT[:searchkick_pagy_search] = :pagy_search
# Default original :search method called internally to do the actual search
# Pagy::DEFAULT[:searchkick_search] = :search
# require 'pagy/extras/searchkick'
# uncomment if you are going to use Searchkick.pagy_search
# Searchkick.extend Pagy::Searchkick

# Frontend Extras

# Bootstrap extra: Add nav, nav_js and combo_nav_js helpers and templates for Bootstrap pagination
# See https://ddnexus.github.io/pagy/docs/extras/bootstrap
require 'pagy/extras/bootstrap'

# Bulma extra: Add nav, nav_js and combo_nav_js helpers and templates for Bulma pagination
# See https://ddnexus.github.io/pagy/docs/extras/bulma
# require 'pagy/extras/bulma'

# Pagy extra: Add the pagy styled versions of the javascript-powered navs
# and a few other components to the Pagy::Frontend module.
# See https://ddnexus.github.io/pagy/docs/extras/pagy
# require 'pagy/extras/pagy'

# Multi size var used by the *_nav_js helpers
# See https://ddnexus.github.io/pagy/docs/extras/pagy#steps
# Pagy::DEFAULT[:steps] = { 0 => 5, 540 => 7, 720 => 9 }   # example

# Feature Extras

# Gearbox extra: Automatically change the limit per page depending on the page number
# See https://ddnexus.github.io/pagy/docs/extras/gearbox
# require 'pagy/extras/gearbox'
# set to false only if you want to make :gearbox_extra an opt-in variable
# Pagy::DEFAULT[:gearbox_extra] = false               # default true
# Pagy::DEFAULT[:gearbox_limit] = [15, 30, 60, 100]   # default

# Limit extra: Allow the client to request a custom limit per page with an optional selector UI
# See https://ddnexus.github.io/pagy/docs/extras/limit
# require 'pagy/extras/limit'
# set to false only if you want to make :limit_extra an opt-in variable
# Pagy::DEFAULT[:limit_extra] = false    # default true
# Pagy::DEFAULT[:limit_param] = :limit   # default
# Pagy::DEFAULT[:limit_max]   = 100      # default

# Overflow extra: Allow for easy handling of overflowing pages
# See https://ddnexus.github.io/pagy/docs/extras/overflow
# require 'pagy/extras/overflow'
# Pagy::DEFAULT[:overflow] = :empty_page    # default  (other options: :last_page and :exception)

# Trim extra: Remove the page=1 param from links
# See https://ddnexus.github.io/pagy/docs/extras/trim
# require 'pagy/extras/trim'
# set to false only if you want to make :trim_extra an opt-in variable
# Pagy::DEFAULT[:trim_extra] = false # default true

# Standalone extra: Use pagy in non Rack environment/gem
# See https://ddnexus.github.io/pagy/docs/extras/standalone
# require 'pagy/extras/standalone'
# Pagy::DEFAULT[:url] = 'http://www.example.com/subdir'  # optional default

# Jsonapi extra: Implements JSON:API specifications
# See https://ddnexus.github.io/pagy/docs/extras/jsonapi
# require 'pagy/extras/jsonapi'   # must be required after the other extras
# set to false only if you want to make :jsonapi an opt-in variable
# Pagy::DEFAULT[:jsonapi] = false  # default true

# Rails
# Enable the .js file required by the helpers that use javascript
# (pagy*_nav_js, pagy*_combo_nav_js, and pagy_limit_selector_js)
# See https://ddnexus.github.io/pagy/docs/api/javascript

# NOTE: Pagy JavaScript is available via npm package if needed

# I18n

# Pagy internal I18n: ~18x faster using ~10x less memory than the i18n gem
# See https://ddnexus.github.io/pagy/docs/api/i18n
# Notice: No need to configure anything in this section if your app uses only "en"
# or if you use the i18n extra below
#
# Pagy::I18n.pathnames << Rails.root.join('config/locales/pagy')

############# I18n Gem Translation #########################################################
# See https://ddnexus.github.io/pagy/resources/i18n/ for details.
#
# Pagy.translate_with_the_slower_i18n_gem!

############# Calendar Localization for non-en locales ####################################
# See https://ddnexus.github.io/pagy/toolbox/paginators/calendar#localization for details.
# Add your desired locales to the list and uncomment the following line to enable them,
# regardless of whether you use the I18n gem for translations or not, whether with
# Rails or not.
#
# Pagy::Calendar.localize_with_rails_i18n_gem(*your_locales)

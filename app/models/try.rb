# frozen_string_literal: true

# == Schema Information
#
# Table name: tries
#
#  id                 :integer          not null, primary key
#  ancestry           :string(3072)
#  escape_query       :boolean          default(TRUE)
#  field_spec         :string(500)
#  name               :string(50)
#  number_of_rows     :integer          default(10)
#  query_params       :string(20000)
#  try_number         :integer
#  created_at         :datetime         not null
#  updated_at         :datetime         not null
#  case_id            :integer
#  search_endpoint_id :bigint
#
# Indexes
#
#  case_id                            (case_id)
#  index_tries_on_search_endpoint_id  (search_endpoint_id)
#  ix_queryparam_tryNo                (try_number)
#
# Foreign Keys
#
#  tries_ibfk_1  (case_id => cases.id)
#

require 'solr_arg_parser'
require 'es_arg_parser'

# rubocop:disable Metrics/ClassLength
class Try < ApplicationRecord
  has_ancestry orphan_strategy: :adopt

  # Scopes
  scope :latest, -> { order(id: :desc).first } # The try created the most recently

  # Associations
  belongs_to :case, optional: true # shouldn't be optional, but was in rails 4

  belongs_to :search_endpoint, optional: true # see above too!#dependent: :nullify

  has_many    :curator_variables,
              dependent:  :destroy,
              inverse_of: :try

  has_many   :snapshots,
             dependent: :nullify

  # Callbacks
  before_create :set_defaults

  # rubocop:disable Metrics/MethodLength
  def args
    search_endpoint_args = {
      'solr'      => lambda {
        solr_args
      },
      'static'    => lambda {
        static_args
      },
      'es'        => lambda {
        es_args
      },
      'os'        => lambda {
        os_args
      },
      'vectara'   => lambda {
        vectara_args
      },
      'algolia'   => lambda {
        algolia_args
      },
      'searchapi' => lambda {
        searchapi_args
      },
    }

    search_endpoint_args.fetch(search_endpoint.search_engine).call unless search_endpoint.nil?
  end
  # rubocop:enable Metrics/MethodLength

  # merge the search endpoint and case options together,
  # with search endpoint options taking precedence
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  # rubocop:disable Metrics/CyclomaticComplexity
  def options
    # NOTE: there is weirdness that case options parse as json
    # but search_endpoint options stay strings and we manually parse them
    # except sometimes we don't ugh.'
    case_options = {}
    if self.case
      if self.case.options.is_a? String
        begin
          case_options = JSON.parse(self.case.options)
        rescue JSON::ParserError
          case_options = {}
        end
      elsif self.case.options.present?
        case_options = self.case.options.to_hash
      end
    end
    search_endpoint_options = {}
    if search_endpoint
      if search_endpoint.options.is_a? String
        begin
          search_endpoint_options = JSON.parse(search_endpoint.options)
        rescue JSON::ParserError
          search_endpoint_options = {}
        end
      elsif search_endpoint.options.present?
        search_endpoint_options = search_endpoint.options.to_hash
      end
    end
    merged_hash = case_options.merge(search_endpoint_options)
    JSON.parse(merged_hash.to_json)
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
  # rubocop:enable Metrics/CyclomaticComplexity

  def param
    try_number
  end

  def add_curator_vars vars = {}
    return if vars.blank?

    vars.each do |name, value|
      curator_variables.create(name: name, value: value)
    end
  end

  def curator_vars_map
    curator_variables.to_h { |each| [ each.name.to_sym, each.value ] }
  end

  def solr_args
    SolrArgParser.parse(query_params, curator_vars_map)
  end

  def es_args
    EsArgParser.parse(query_params, curator_vars_map)
  end

  def os_args
    # Use the EsArgParser as currently queries are the same
    EsArgParser.parse(query_params, curator_vars_map)
  end

  def static_args
    # Use the SolrArgParser as that is the only parser that the Static search endpoint knows
    SolrArgParser.parse(query_params, curator_vars_map)
  end

  def vectara_args
    # Use the EsArgParser as currently queries are the same
    EsArgParser.parse(query_params, curator_vars_map)
  end

  def algolia_args
    # Use the EsArgParser as currently queries are the same
    EsArgParser.parse(query_params, curator_vars_map)
  end

  def searchapi_args
    if query_params.starts_with?('{')
      EsArgParser.parse(query_params,
                        curator_vars_map)
    else
      SolrArgParser.parse(query_params,
                          curator_vars_map)
    end
  end

  def id_from_field_spec
    # logic is inspired by https://github.com/o19s/splainer-search/blob/main/services/fieldSpecSvc.js

    # rubocop:disable Style/IfUnlessModifier
    # rubocop:disable Style/MultipleComparison
    # rubocop:disable Style/Next
    # rubocop:disable Style/SoleNestedConditional
    if 'id' == field_spec || '_id' == field_spec
      return field_spec
    end

    field_specs = field_spec.split(/[\s,]+/)
    field_specs.each do |fs|
      if 'id' == fs || '_id' == fs
        return fs
      end

      type_and_field = fs.split(':')
      if 2 == type_and_field.length
        if 'id' == type_and_field[0]
          return type_and_field[1]
        end
      end
    end
    # rubocop:enable Style/IfUnlessModifier
    # rubocop:enable Style/MultipleComparison
    # rubocop:enable Style/Next
    # rubocop:enable Style/SoleNestedConditional
  end

  def index_name_from_search_url
    # NOTE: currently all supported engines have the index name as second to last element, refactor when this changes
    case search_endpoint.search_engine
    when 'solr', 'es', 'os'
      search_endpoint.endpoint_url.split('/')[-2]
    end
  end

  private

  def set_defaults
    self.try_number = 1 if try_number.blank?
    self.name = "Try #{try_number}" if name.blank?
    self.number_of_rows = 10 if number_of_rows.blank?
  end
end
# rubocop:enable Metrics/ClassLength

# frozen_string_literal: true

# require 'active_support'
# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :document_fields
]

Rails.application.config.filter_parameters += [
  'query_doc_pair.document_fields',
  'snapshot.docs',
  'snapshot_doc.explain',
  'snapshot_doc.fields'
]

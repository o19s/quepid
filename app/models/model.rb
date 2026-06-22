# frozen_string_literal: true

# == Schema Information
#
# Table name: models
#
#  id                :bigint           not null, primary key
#  capabilities      :json
#  context_window    :integer
#  family            :string(255)
#  knowledge_cutoff  :date
#  max_output_tokens :integer
#  metadata          :json
#  modalities        :json
#  model_created_at  :datetime
#  name              :string(255)      not null
#  pricing           :json
#  provider          :string(255)      not null
#  created_at        :datetime         not null
#  updated_at        :datetime         not null
#  model_id          :string(255)      not null
#
# Indexes
#
#  index_models_on_family                 (family)
#  index_models_on_provider               (provider)
#  index_models_on_provider_and_model_id  (provider,model_id) UNIQUE
#
class Model < ApplicationRecord
  acts_as_model
end

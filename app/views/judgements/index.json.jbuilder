# frozen_string_literal: true

json.array! @judgements, partial: 'judgements/judgement', as: :judgement

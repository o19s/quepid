# frozen_string_literal: true

json.array! @scores, partial: 'event', as: :score

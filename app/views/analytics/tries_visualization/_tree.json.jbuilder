# frozen_string_literal: true

json.id             try.id
json.name           try.name
json.parent         try.parent_id unless try.parent_id.nil?
json.size           10
json.url            case_core_path(id: @case.id, try_number: try.try_number)
json.query_params   try.query_params

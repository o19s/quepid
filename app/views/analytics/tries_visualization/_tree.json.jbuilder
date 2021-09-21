# frozen_string_literal: true

json.id             try.id
json.name           try.name
json.parent         try.parent_id if try.parent
json.size           10
json.url            case_home_url(id: @case.id, try_number: try.try_number)
json.query_params   try.query_params

# frozen_string_literal: true

# Small, on-demand lists for the sharing and usage pills on management pages.
class RelationshipItemsController < ApplicationController
  SOURCE_SCOPES = {
    'case'            => :cases_involved_with,
    'book'            => :books_involved_with,
    'embedder'        => :embedders_involved_with,
    'scorer'          => :scorers_involved_with,
    'search_endpoint' => :search_endpoints_involved_with,
  }.freeze

  def show
    @source = source_scope&.find_by(id: params[:id])
    return head :not_found unless @source

    @kind = params[:kind]
    records = related_records
    return head :bad_request unless records

    # Case initialization loads scoring settings; this list only needs names and ids.
    @items = if 'cases' == @kind
               records.pluck(:case_name, :id).map { |name, id| [ name, case_core_path(id: id) ] }
             else
               records.map { |record| item_link(record) }
             end
    render layout: false
  end

  private

  def source_scope
    return AiJudge.for_user(current_user) if 'ai_judge' == params[:record_type]

    scope = SOURCE_SCOPES[params[:record_type]]
    current_user.public_send(scope) if scope
  end

  def related_records
    case @kind
    when 'teams'
      current_user.teams.where(id: @source.teams.select(:id)).select(:id, :name).order(:name)
    when 'cases'
      related_cases&.order(:case_name)
    when 'tries'
      return unless @source.is_a?(SearchEndpoint)

      @source.tries.joins(:case).where(case_id: current_user.cases_involved_with.select(:id))
        .select(:id, :name, :case_id, :try_number, 'cases.case_name AS case_name')
        .reorder('cases.case_name', :try_number)
    end
  end

  def related_cases
    cases = current_user.cases_involved_with
    case @source
    when Book then cases.where(book_id: @source.id)
    when Embedder then cases.where(embedder_id: @source.id)
    when Scorer then cases.where(scorer_id: @source.id)
    when SearchEndpoint then cases.where(id: @source.tries.select(:case_id))
    end
  end

  def item_link record
    case @kind
    when 'teams' then [ record.name, team_path(record) ]
    when 'tries'
      label = "#{record[:case_name]} — Try #{record.try_number}"
      label += ": #{record.name}" if record.name.present? && record.name != "Try #{record.try_number}"
      [ label, case_core_path(id: record.case_id, try_number: record.try_number) ]
    end
  end
end

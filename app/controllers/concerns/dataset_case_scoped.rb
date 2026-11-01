# frozen_string_literal: true

# For the controllers that act on one case the user made from a dataset, and on one of the user's search endpoints.
# The case comes from the address and the endpoint from the form; both are checked before anything happens.
module DatasetCaseScoped
  extend ActiveSupport::Concern

  included do
    before_action :set_link
    before_action :set_endpoint
  end

  private

  def set_link
    @link = CaseToDataset.joins(:dataset).where(datasets: { owner_id: current_user.id }).find(params.expect(:dataset_case_id))
    @kase = @link.case
    @entry = DatasetCatalog.find(@link.dataset.key)
    if @link.in_progress?
      redirect_to dataset_cases_path, alert: "#{@kase.case_name} is still loading: try again when that has finished.", status: :see_other
    elsif @kase.owner_id != current_user.id
      redirect_to dataset_cases_path, alert: "#{@kase.case_name} belongs to someone else, so its search endpoint cannot be changed from here.", status: :see_other
    end
  end

  def set_endpoint
    @endpoint = current_user.search_endpoints_involved_with.not_archived.find_by(id: params.fetch(:search_endpoint_id, nil))
    redirect_to(dataset_cases_path, alert: 'Pick a search endpoint you can use.', status: :see_other) unless @endpoint
  end
end

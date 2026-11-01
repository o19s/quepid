# frozen_string_literal: true

module Datasets
  # Keeps the files of a dataset that Quepid cannot download itself, which the user has fetched and uploads: the Home
  # Depot competition's, which Kaggle only gives to someone signed in who has accepted the competition's rules.
  class UploadsController < ApplicationController
    def create
      dataset = DatasetCatalog.find(params.expect(:dataset_id))
      return redirect_to(datasets_path, alert: 'That dataset is not uploaded: Quepid fetches it itself.', status: :see_other) unless dataset&.upload

      file = params[:file]
      return redirect_to(datasets_path, alert: "Choose the zip of #{dataset.name} to upload.", status: :see_other) unless file.respond_to?(:path)

      dataset.upload.store!(file.path)
      redirect_to datasets_path, notice: "Uploaded the #{dataset.name} files.", status: :see_other
    rescue HomeDepotData::Error => e
      redirect_to datasets_path, alert: "Could not use that upload: #{e.message}", status: :see_other
    end
  end
end

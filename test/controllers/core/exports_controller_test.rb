# frozen_string_literal: true

require "test_helper"

module Core
  class ExportsControllerTest < ActionDispatch::IntegrationTest
    setup do
      @user = users(:doug)
      login_user_for_integration_test(@user)
      @case = cases(:one)
    end

    test "create queues export job for general format" do
      assert_enqueued_with(job: ExportCaseJob) do
        post case_export_path(@case),
             params: { export_format: "general" },
             headers: { "Accept" => "text/vnd.turbo-stream.html" }
      end
      assert_response :accepted
    end

    test "create queues export job for quepid format" do
      assert_enqueued_with(job: ExportCaseJob) do
        post case_export_path(@case),
             params: { export_format: "quepid" },
             headers: { "Accept" => "text/vnd.turbo-stream.html" }
      end
      assert_response :accepted
    end

    test "create returns unprocessable for unsupported format" do
      post case_export_path(@case), params: { export_format: "invalid" }
      assert_response :unprocessable_entity
    end

    test "download redirects when no export file" do
      get case_export_download_path(@case)
      assert_redirected_to case_core_path(@case, @case.tries.latest)
    end
  end
end

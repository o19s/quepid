# frozen_string_literal: true

require 'test_helper'

load Rails.root.join('lib/tasks/sample_data.thor')

class SampleDataLargeDataModeTest < ActiveSupport::TestCase
  let(:cli) { SampleData.new([], {}, {}) }

  describe 'resolve_large_data_mode' do
    test 'defaults to :create when no mode flags are set' do
      mode = cli.send(
        :resolve_large_data_mode,
        { clean: false, update: false, create: false }
      )

      assert_equal :create, mode
    end

    test 'uses --clean when set' do
      mode = cli.send(
        :resolve_large_data_mode,
        { clean: true, update: false, create: false }
      )

      assert_equal :clean, mode
    end

    test 'accepts string keys like Thor may supply' do
      mode = cli.send(
        :resolve_large_data_mode,
        { 'clean' => true, 'update' => false, 'create' => false }
      )

      assert_equal :clean, mode
    end

    test 'uses --update when set' do
      mode = cli.send(
        :resolve_large_data_mode,
        { clean: false, update: true, create: false }
      )

      assert_equal :update, mode
    end

    test 'uses --create when explicitly set' do
      mode = cli.send(
        :resolve_large_data_mode,
        { clean: false, update: false, create: true }
      )

      assert_equal :create, mode
    end

    test 'raises when more than one mode flag is set' do
      error = assert_raises(Thor::Error) do
        cli.send(
          :resolve_large_data_mode,
          { clean: true, update: false, create: true }
        )
      end

      assert_match(/at most one/, error.message)
    end
  end
end

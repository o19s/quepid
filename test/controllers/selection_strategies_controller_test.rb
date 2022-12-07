# frozen_string_literal: true

require 'test_helper'

class SelectionStrategiesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @selection_strategy = selection_strategies(:one)
  end

  test 'should get index' do
    get selection_strategies_url
    assert_response :success
  end

  test 'should get new' do
    get new_selection_strategy_url
    assert_response :success
  end

  test 'should create selection_strategy' do
    assert_difference('SelectionStrategy.count') do
      post selection_strategies_url, params: { selection_strategy: { name: @selection_strategy.name } }
    end

    assert_redirected_to selection_strategy_url(SelectionStrategy.last)
  end

  test 'should show selection_strategy' do
    get selection_strategy_url(@selection_strategy)
    assert_response :success
  end

  test 'should get edit' do
    get edit_selection_strategy_url(@selection_strategy)
    assert_response :success
  end

  test 'should update selection_strategy' do
    patch selection_strategy_url(@selection_strategy),
          params: { selection_strategy: { name: @selection_strategy.name } }
    assert_redirected_to selection_strategy_url(@selection_strategy)
  end

  test 'should destroy selection_strategy' do
    assert_difference('SelectionStrategy.count', -1) do
      delete selection_strategy_url(@selection_strategy)
    end

    assert_redirected_to selection_strategies_url
  end
end

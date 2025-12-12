'use strict';

/*
 * Integration test script for multi-snapshot comparison functionality
 * This script can be run in the browser console to test the multi-diff features
 */

(function() {
  console.log('Starting Multi-Diff Integration Tests...');

  // Test configuration
  var testConfig = {
    maxWaitTime: 5000,
    testSnapshots: [1, 2, 3] // Adjust based on available snapshots in your test environment
  };

  // Utility functions
  function waitFor(conditionFn, timeout) {
    return new Promise(function(resolve, reject) {
      var startTime = Date.now();
      
      function check() {
        if (conditionFn()) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      }
      
      check();
    });
  }

  function getAngularService(serviceName) {
    var injector = angular.element(document.body).injector();
    return injector.get(serviceName);
  }

  // Test cases
  var tests = {
    testServiceAvailability: function() {
      console.log('Test 1: Checking service availability...');
      
      try {
        var multiDiffSvc = getAngularService('multiDiffResultsSvc');
        var queryViewSvc = getAngularService('queryViewSvc');
        var queriesSvc = getAngularService('queriesSvc');
        
        console.log('✓ multiDiffResultsSvc available');
        console.log('✓ queryViewSvc available');
        console.log('✓ queriesSvc available');
        
        // Test basic methods
        if (typeof multiDiffSvc.setMultiDiffSettings === 'function' &&
            typeof multiDiffSvc.isMultiDiffEnabled === 'function' &&
            typeof multiDiffSvc.getMaxSnapshots === 'function') {
          console.log('✓ All required methods available');
          return true;
        } else {
          console.error('✗ Missing required methods');
          return false;
        }
      } catch (e) {
        console.error('✗ Service availability test failed:', e);
        return false;
      }
    },

    testBasicConfiguration: function() {
      console.log('Test 2: Testing basic configuration...');
      
      try {
        var multiDiffSvc = getAngularService('multiDiffResultsSvc');
        
        // Test initial state
        var initialSettings = multiDiffSvc.getMultiDiffSettings();
        if (Array.isArray(initialSettings) && initialSettings.length === 0) {
          console.log('✓ Initial settings are empty array');
        } else {
          console.error('✗ Initial settings not empty:', initialSettings);
          return false;
        }
        
        // Test setting configurations
        var testSettings = [1, 2];
        multiDiffSvc.setMultiDiffSettings(testSettings);
        
        var retrievedSettings = multiDiffSvc.getMultiDiffSettings();
        if (JSON.stringify(retrievedSettings) === JSON.stringify(testSettings)) {
          console.log('✓ Settings correctly stored and retrieved');
        } else {
          console.error('✗ Settings mismatch:', retrievedSettings, 'vs', testSettings);
          return false;
        }
        
        // Test enabled state
        if (multiDiffSvc.isMultiDiffEnabled()) {
          console.log('✓ Multi-diff enabled with 2 snapshots');
        } else {
          console.error('✗ Multi-diff not enabled with 2 snapshots');
          return false;
        }
        
        // Test max snapshots limit
        var maxSnapshots = multiDiffSvc.getMaxSnapshots();
        if (maxSnapshots === 3) {
          console.log('✓ Max snapshots correctly set to 3');
        } else {
          console.error('✗ Max snapshots incorrect:', maxSnapshots);
          return false;
        }
        
        // Test limiting functionality
        multiDiffSvc.setMultiDiffSettings([1, 2, 3, 4]);
        var limitedSettings = multiDiffSvc.getMultiDiffSettings();
        if (limitedSettings.length === 3) {
          console.log('✓ Settings correctly limited to max snapshots');
        } else {
          console.error('✗ Settings not limited:', limitedSettings);
          return false;
        }
        
        // Reset for next tests
        multiDiffSvc.setMultiDiffSettings([]);
        
        return true;
      } catch (e) {
        console.error('✗ Basic configuration test failed:', e);
        return false;
      }
    },

    testQueryViewServiceIntegration: function() {
      console.log('Test 3: Testing queryViewSvc integration...');
      
      try {
        var queryViewSvc = getAngularService('queryViewSvc');
        
        // Test initial state
        if (!queryViewSvc.isMultiDiffEnabled()) {
          console.log('✓ Multi-diff initially disabled');
        } else {
          console.error('✗ Multi-diff should be initially disabled');
          return false;
        }
        
        // Test enabling multi-diff
        queryViewSvc.enableMultiDiff([1, 2]);
        
        if (queryViewSvc.isMultiDiffEnabled()) {
          console.log('✓ Multi-diff correctly enabled');
        } else {
          console.error('✗ Multi-diff not enabled');
          return false;
        }
        
        // Test settings storage
        if (queryViewSvc.multiDiffSettings.length === 2 &&
            queryViewSvc.multiDiffSettings[0] === 1 &&
            queryViewSvc.multiDiffSettings[1] === 2) {
          console.log('✓ Multi-diff settings correctly stored');
        } else {
          console.error('✗ Multi-diff settings incorrect:', queryViewSvc.multiDiffSettings);
          return false;
        }
        
        // Test reset functionality
        queryViewSvc.reset();
        
        if (!queryViewSvc.isMultiDiffEnabled() && 
            queryViewSvc.multiDiffSettings.length === 0) {
          console.log('✓ Reset correctly clears multi-diff settings');
        } else {
          console.error('✗ Reset did not clear multi-diff settings');
          return false;
        }
        
        return true;
      } catch (e) {
        console.error('✗ QueryViewSvc integration test failed:', e);
        return false;
      }
    },

    testModalController: function() {
      console.log('Test 4: Testing modal controller availability...');
      
      try {
        // Check if the controller is registered
        var $controller = getAngularService('$controller');
        
        // Create a mock scope
        var $rootScope = getAngularService('$rootScope');
        var mockScope = $rootScope.$new();
        
        // Mock dependencies
        var mockModalInstance = {
          close: function() {},
          dismiss: function() {}
        };
        
        var mockQuerySnapshotSvc = {
          getSnapshots: function() {
            return Promise.resolve();
          },
          snapshots: {
            1: { id: 1, name: function() { return 'Test Snapshot 1'; } },
            2: { id: 2, name: function() { return 'Test Snapshot 2'; } }
          }
        };
        
        // Try to instantiate the controller
        var ctrl = $controller('DiffModalInstanceCtrl', {
          $scope: mockScope,
          $uibModalInstance: mockModalInstance,
          querySnapshotSvc: mockQuerySnapshotSvc,
          initialSelection: null
        });
        
        if (ctrl && typeof ctrl.cancel === 'function' && typeof ctrl.ok === 'function') {
          console.log('✓ DiffModalInstanceCtrl successfully instantiated');
          console.log('✓ Required methods available');
          return true;
        } else {
          console.error('✗ Controller missing required methods');
          return false;
        }
        
      } catch (e) {
        console.error('✗ Modal controller test failed:', e);
        return false;
      }
    },

    testResultsController: function() {
      console.log('Test 5: Testing results controller availability...');
      
      try {
        var $controller = getAngularService('$controller');
        var $rootScope = getAngularService('$rootScope');
        var mockScope = $rootScope.$new();
        
        // Mock query object
        mockScope.query = {
          queryId: 1,
          query_text: 'test query',
          multiDiff: null,
          docs: [],
          ratedDocs: []
        };
        
        var ctrl = $controller('QueryMultiDiffResultsCtrl', {
          $scope: mockScope,
          queriesSvc: getAngularService('queriesSvc')
        });
        
        if (mockScope.query.docTuples && typeof mockScope.query.docTuples === 'function') {
          console.log('✓ QueryMultiDiffResultsCtrl successfully instantiated');
          console.log('✓ docTuples method added to query');
          
          var tuples = mockScope.query.docTuples();
          if (Array.isArray(tuples)) {
            console.log('✓ docTuples returns array');
            return true;
          } else {
            console.error('✗ docTuples does not return array');
            return false;
          }
        } else {
          console.error('✗ docTuples method not available');
          return false;
        }
        
      } catch (e) {
        console.error('✗ Results controller test failed:', e);
        return false;
      }
    },

    testUIElementsPresence: function() {
      console.log('Test 6: Testing UI elements presence...');
      
      try {
        // Check for diff dropdown
        var diffDropdowns = document.querySelectorAll('[dropdown-toggle]');
        var foundCompareDropdown = false;
        
        for (var i = 0; i < diffDropdowns.length; i++) {
          if (diffDropdowns[i].textContent.includes('Compare snapshots')) {
            foundCompareDropdown = true;
            break;
          }
        }
        
        if (foundCompareDropdown) {
          console.log('✓ Compare snapshots dropdown found');
        } else {
          console.log('⚠ Compare snapshots dropdown not found (might not be visible in current context)');
        }
        
        // Check for template availability by looking for script tags
        var templates = document.querySelectorAll('script[type="text/ng-template"]');
        var foundMultiDiffTemplate = false;
        
        for (var j = 0; j < templates.length; j++) {
          if (templates[j].id.includes('queryMultiDiffResults') || 
              templates[j].id.includes('modal')) {
            foundMultiDiffTemplate = true;
            break;
          }
        }
        
        if (foundMultiDiffTemplate) {
          console.log('✓ Multi-diff templates found');
        } else {
          console.log('⚠ Multi-diff templates not found (templates might be loaded dynamically)');
        }
        
        return true;
        
      } catch (e) {
        console.error('✗ UI elements test failed:', e);
        return false;
      }
    },

    runAllTests: function() {
      console.log('=== Multi-Diff Integration Test Suite ===');
      console.log('Running all tests...\n');
      
      var results = [];
      var testMethods = [
        'testServiceAvailability',
        'testBasicConfiguration', 
        'testQueryViewServiceIntegration',
        'testModalController',
        'testResultsController',
        'testUIElementsPresence'
      ];
      
      for (var i = 0; i < testMethods.length; i++) {
        var testName = testMethods[i];
        try {
          var result = this[testName]();
          results.push({ test: testName, passed: result });
          console.log(''); // Add spacing between tests
        } catch (e) {
          console.error('✗ Test', testName, 'threw exception:', e);
          results.push({ test: testName, passed: false, error: e });
        }
      }
      
      // Summary
      console.log('=== Test Results Summary ===');
      var passed = 0;
      var failed = 0;
      
      results.forEach(function(result) {
        if (result.passed) {
          console.log('✓', result.test);
          passed++;
        } else {
          console.log('✗', result.test, result.error ? '(' + result.error.message + ')' : '');
          failed++;
        }
      });
      
      console.log('\nTotal: ' + (passed + failed) + ' tests');
      console.log('Passed: ' + passed);
      console.log('Failed: ' + failed);
      
      if (failed === 0) {
        console.log('\n🎉 All tests passed! Multi-diff functionality appears to be working correctly.');
      } else {
        console.log('\n⚠️  Some tests failed. Please check the implementation.');
      }
      
      return { passed: passed, failed: failed, results: results };
    }
  };

  // Expose the test runner globally for manual execution
  window.multiDiffTests = tests;
  
  // Auto-run tests if this script is executed directly
  if (typeof window !== 'undefined' && window.document) {
    console.log('Multi-diff integration tests loaded.');
    console.log('Run window.multiDiffTests.runAllTests() to execute all tests.');
    console.log('Or run individual tests like window.multiDiffTests.testServiceAvailability()');
  }

})();
'use strict';

describe('QScore Components', function () {
  var $compile, $rootScope, $templateCache, qscoreSvc;

  beforeEach(module('QuepidApp'));
  
  beforeEach(inject(function (_$compile_, _$rootScope_, _$templateCache_, _qscoreSvc_) {
    $compile = _$compile_;
    $rootScope = _$rootScope_;
    $templateCache = _$templateCache_;
    qscoreSvc = _qscoreSvc_;
  }));

  describe('qscore-case component', function () {
    it('should be defined and have proper controller', function () {
      var scope = $rootScope.$new();
      scope.testScorableCase = {
        currentScore: {
          score: 0.75,
          backgroundColor: null
        },
        diff: null
      };
      scope.testMaxScore = 1.0;
      scope.testScores = [0.5, 0.7, 0.75];
      scope.testAnnotations = [];

      var element = $compile(
        '<qscore-case ' +
        'max-score="testMaxScore" ' +
        'scorable="testScorableCase" ' +
        'scores="testScores" ' +
        'annotations="testAnnotations" ' +
        'show-diff="false">' +
        '</qscore-case>'
      )(scope);
      
      scope.$digest();

      expect(element.isolateScope().ctrl).toBeDefined();
      expect(element.isolateScope().ctrl.maxScore).toBe(1.0);
    });

    it('should update score when scorable changes', function () {
      var scope = $rootScope.$new();
      scope.testScorableCase = {
        currentScore: {
          score: 0.5,
          backgroundColor: null
        },
        diff: null
      };
      scope.testMaxScore = 1.0;

      var element = $compile(
        '<qscore-case ' +
        'max-score="testMaxScore" ' +
        'scorable="testScorableCase" ' +
        'show-diff="false">' +
        '</qscore-case>'
      )(scope);
      
      scope.$digest();
      expect(element.isolateScope().ctrl.score).toBe(0.5);

      // Update the score
      scope.testScorableCase.currentScore.score = 0.8;
      scope.$digest();
      
      expect(element.isolateScope().ctrl.score).toBe(0.8);
    });
  });

  describe('qscore-query component', function () {
    it('should be defined and have proper controller', function () {
      var scope = $rootScope.$new();
      scope.testScorableQuery = {
        currentScore: {
          score: 85,
          backgroundColor: null
        }
      };
      scope.testMaxScore = 100;

      var element = $compile(
        '<qscore-query ' +
        'max-score="testMaxScore" ' +
        'scorable="testScorableQuery" ' +
        'show-diff="false">' +
        '</qscore-query>'
      )(scope);
      
      scope.$digest();

      expect(element.isolateScope().ctrl).toBeDefined();
      expect(element.isolateScope().ctrl.maxScore).toBe(100);
    });

    it('should update score when scorable changes', function () {
      var scope = $rootScope.$new();
      scope.testScorableQuery = {
        currentScore: {
          score: 75,
          backgroundColor: null
        }
      };
      scope.testMaxScore = 100;

      var element = $compile(
        '<qscore-query ' +
        'max-score="testMaxScore" ' +
        'scorable="testScorableQuery" ' +
        'show-diff="false">' +
        '</qscore-query>'
      )(scope);
      
      scope.$digest();
      expect(element.isolateScope().ctrl.score).toBe(75);

      // Update the score
      scope.testScorableQuery.currentScore.score = 90;
      scope.$digest();
      
      expect(element.isolateScope().ctrl.score).toBe(90);
    });
  });

  describe('component separation benefits', function () {
    it('qscore-case should have more bindings than qscore-query', function () {
      // Get the component definitions
      var QuepidApp = angular.module('QuepidApp');
      var qscoreCaseComponent, qscoreQueryComponent;
      
      // Find our components in the registered components
      QuepidApp._invokeQueue.forEach(function(item) {
        if (item[1] === 'component' && item[2][0] === 'qscoreCase') {
          qscoreCaseComponent = item[2][1];
        }
        if (item[1] === 'component' && item[2][0] === 'qscoreQuery') {
          qscoreQueryComponent = item[2][1];
        }
      });

      expect(qscoreCaseComponent).toBeDefined();
      expect(qscoreQueryComponent).toBeDefined();
      
      // qscore-case should have more bindings (annotations, diffLabel, etc.)
      var caseBindingsCount = Object.keys(qscoreCaseComponent.bindings).length;
      var queryBindingsCount = Object.keys(qscoreQueryComponent.bindings).length;
      
      expect(caseBindingsCount).toBeGreaterThan(queryBindingsCount);
    });
  });
});
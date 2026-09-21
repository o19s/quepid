'use strict';

/*angular.module('QuepidApp').provider('$httpBackend',
      angular.mock.$HttpBackendProvider
    );*/

// optionally place this in a run to mock the backend completely
window.mockBackend = function(angModule) {
  angModule
  .config(function($provide) {
    /*global createHttpBackendMock*/
    $provide.decorator('$httpBackend', createHttpBackendMock);
  });

  angModule
  .run(function($httpBackend, $timeout, $log) {

    var regexpUrl = function(regexp) {
      return {
        test: function(url) {
          this.matches = url.match(regexp);
          return this.matches && this.matches.length > 0;
        }

      };
    };

    var activeCases = {'allCases':
                        [{caseName: 'Grocery Store',
                          caseNo: 0},
                         {caseName: 'State Decoded',
                          caseNo: 1}]};

    //*******************************************
    // Send JSONP to the other URL
    $httpBackend.when('JSONP', regexpUrl(/http:\/\/.*/))
    .passThrough();

    $httpBackend.when('GET', regexpUrl(/views.*/))
    .passThrough();

    // *******************************************
    // Cases API
    $httpBackend.when('GET', '/cases')
    .respond(function(method, url, data) {
      data = angular.fromJson(data);
      $log.debug('Mock /cases ! at: ' + url + ' Got: ' + data);
      return [200, activeCases];
    });

    $httpBackend.when('PUT', '/cases')
    .respond(function(method, url, data) {
      data = angular.fromJson(data);
      var nextCaseId = activeCases.allCases.length;
      var newCase = {caseNo: nextCaseId,
                     caseName: data.caseName};
      activeCases.allCases[nextCaseId] = newCase;
      return [200, newCase];
    });

    $httpBackend.when('POST', regexpUrl(/\/cases\/(\d*)$/))
    .respond(function(method, url, data) {
      data = angular.fromJson(data);
      $log.debug('Mock /cases/id ! at: ' + url + ' Got: ' + data);
      activeCases.allCases[data.caseNo] = data;
      return [200, activeCases];
    });


    // *******************************************
    // Settings API

    var settings = [{
        searchUrl: 'http://solr.quepidapp.com/solr/collection1/select',
        fieldSpec: 'name thumb:firstImageUrl optionPrices',
        //fieldSpec: 'name optionPrices',
        queryParamsHistory: [
          {queryParams: 'q=#$query##',
           curatorVars: {var1: 5}},
          {queryParams: 'q=#$query##&bq=name:chocolate&bq=name:nuts^4',
           curatorVars: {var1: 5}},
          {queryParams: 'echoParams=thisisanerror&q=#$query##&bq=name:chocolate&bq=name:nuts^4',
           curatorVars: {var1: 5}},
        ]
      }, {
        searchUrl: 'http://solr.quepidapp.com/solr/statedecoded/select',
        fieldSpec: 'catch_line score text',
        //fieldSpec: 'name optionPrices',
        queryParamsHistory: [
          {queryParams: 'q=#$query##',
           curatorVars: {var1: 5}},
          {queryParams: 'q=#$query##&bq=catch_line:law',
           curatorVars: {var1: 5}},
          {queryParams: 'q=#$query##&bq=catch_line:law^##var1##',
           curatorVars: {var1: 5}},
        ]
      }

    ];

    $httpBackend.when('GET', regexpUrl(/\/cases\/(\d*)\/settings$/))
    .respond(function(method, url, data) {
      var caseNo = 0;
      if (url.indexOf('/cases/1') === 0) {
        caseNo = 1;
      }
      data = angular.fromJson(data);

      $log.debug('Mock /cases/id/settings ! at: ' + url + ' Got: ' + data);
      return [200, settings[caseNo]];
    });

    $httpBackend.when('POST', regexpUrl(/\/cases\/(\d*)\/settings$/))
    .respond(function(method, url, data) {
      var caseNo = 0;
      if (url.indexOf('/cases/1') === 0) {
        caseNo = 1;
      }
      data = angular.fromJson(data);
      settings.searchUrl = data.searchUrl;
      settings.fieldSpec = data.fieldSpec;

      var found = false;
      angular.forEach(settings.queryParamsHistory, function(qp) {
        if (qp.curatorVars === data.curatorVars &&
            qp.queryParams === data.queryParams)
        {
          found = true;
        }
      });

      if (!found) {
        var newSettings = {queryParams: data.queryParams,
                           curatorVars: data.curatorVars };
        settings.queryParamsHistory.push(newSettings);
      }
      return [200, settings[caseNo]];
    });

    var qpParsedGrocery = {q: ['#$query##'],
                            bq: ['name:chocolate', 'name:nuts^4']};

    // *******************************************
    // Tries API
    var aTryGrocery = {
      settings: {
        searchUrl: settings[0].searchUrl,
        args: qpParsedGrocery,
        fieldSpec: settings[0].fieldSpec,
      },
      queriesWithRatings: {
        '0': {
          'query_text': 'steak',
          queryId: 0
        },
        '1': {
          'query_text': 'apple juice',
          queryId: 1
        }
      },
      displayOrder: [1, 0]
    };

    var aTryStateDecoded = {
      settings: {
        searchUrl: settings[1].searchUrl,
        args: qpParsedGrocery,
        fieldSpec: settings[1].fieldSpec,
      },
      queriesWithRatings: {
        '0': {
          'query_text': 'shoplifting',
          queryId: 0
        },
        '1': {
          'query_text': 'no child left behind',
          queryId: 1
        },
        '2': {
          'query_text': 'school lunch',
          queryId: 2
        }
      },
      displayOrder: [1, 0, 2]
    };

    var makeLotsOfQueries = function() {
      var numQueries = 10;
      for (var i = 2; i < numQueries; ++i) {
        aTryGrocery.queriesWithRatings[i] = {'query_text': 'food item ' + i,
                                 queryId: i};
        aTryGrocery.displayOrder.push(i);
      }
    };

    makeLotsOfQueries();

    $httpBackend.when('GET', regexpUrl(/\/cases\/(\d*)\/tries\/(\d*)$/))
    .respond(function(method, url, data) {
      var aTry = aTryGrocery;
      if (url.indexOf('/cases/1') === 0) {
        aTry = aTryStateDecoded;
      }
      data = angular.fromJson(data);
      return [200, aTry];
    });

    $httpBackend.when('GET', regexpUrl(/\/cases\/(\d*)\/queries\/(\d*)\/notes/))
    .respond(function() {
      return [200, {notes: 'blah blah notes'}];
    });

    $httpBackend.when('PUT', regexpUrl(/\/cases\/(\d*)\/queries\/(\d*)\/notes/))
    .respond(function() {
      return [200, {notes: 'blah blah notes'}];
    });


    $httpBackend.when('PUT', regexpUrl(/\/cases\/(\d*)\/queries/))
    .respond(function(method, url, data) {
      var aTry = aTryGrocery;
      if (url.indexOf('/cases/1') === 0) {
        aTry = aTryStateDecoded;
      }
      data = angular.fromJson(data);
      var queryText = data.queryText;
      var newQueryId = aTry.displayOrder.length;
      /*jshint camelcase:false*/
      aTry.queriesWithRatings[newQueryId] = {queryId: newQueryId,
                                             query_text: queryText};
      /*jshint camelcase:true*/
      var insertId = data.queryIdBefore;
      var insertIdx = 0;
      var i = 0;
      if (insertId !== -1) {
        angular.forEach(aTry.displayOrder, function(displayQueryId) {
          if (insertId === displayQueryId) {
            insertIdx = i + 1;
          }
          ++i;
        });
      }
      aTry.displayOrder.splice(insertIdx, 0, newQueryId);

      var respData = {
        queriesWithRatings: {
        },
        displayOrder: aTry.displayOrder
      };

      respData.queriesWithRatings[newQueryId] = aTry.queriesWithRatings[newQueryId];

      return [200, respData];
    });

    $httpBackend.when('POST', regexpUrl(/\/cases\/(\d*)\/queries\/(\d*)\/ratings\/(.*)$/))
    .respond(function() {
      return [200, {}];
    });

    $httpBackend.when('DELETE', regexpUrl(/\/cases\/(\d*)\/queries\/(\d*)\/ratings\/(.*)$/))
    .respond(function() {
      return [200, {}];
    });

    $httpBackend.when('GET', '/logout')
    .respond(function() {
      return [200, {}];
    });

    var flushBackend = function() {
      try {
        $httpBackend.flush();
      } catch (err) {
        // ignore that there's nothing to flush
      }
      $timeout(flushBackend, 500);
    };
    $timeout(flushBackend, 500);


  });
};

// declare for testing
angular.module('QuepidTest', ['ngMock', 'QuepidApp'])
  // caseTryNavSvc.navigateTo() does a real $window.location.assign() now
  // (previously $location.path(), which ngMock already virtualizes for
  // every spec automatically). Wrapping/mutating the real $window or
  // window.location to neutralize this doesn't work -- Location's methods
  // are brand-checked ("Illegal invocation") on anything but the one real
  // window/location, and some are unforgeable (can't be redefined at all).
  // Instead, neutralize the method on caseTryNavSvc itself whenever no spec
  // has provided its own $window mock (i.e. $window is still the real
  // browser window) -- otherwise an unrelated spec's $httpBackend.flush()
  // could trigger a real browser navigation and abort the whole Karma run.
  // Specs asserting on navigation itself (caseTryNavSvc_spec.js,
  // settingsSvc_spec.js) provide their own $window via $provide.value, so
  // $window !== window there and this is a pass-through.
  // notFound() no longer navigates at all (it flashes an error and stays on
  // the page), so it needs no such guard.
  .config(function($provide) {
    $provide.decorator('caseTryNavSvc', ['$delegate', '$window', function($delegate, $window) {
      if ($window === window) {
        $delegate.navigateTo = function() {};
      }
      return $delegate;
    }]);
  });

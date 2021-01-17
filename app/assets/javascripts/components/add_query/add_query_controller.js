'use strict';

/* jshint latedef:false */

angular.module('QuepidApp')
  .controller('AddQueryCtrl', [
    '$rootScope',
    '$timeout',
    'flash',
    'queriesSvc',
    function (
      $rootScope,
      $timeout,
      flash,
      queriesSvc
    ) {
      var ctrl  = this;
      var delim = ';';

      ctrl.text     = '';
      ctrl.loading  = false;

      // Functions
      ctrl.handlePaste  = handlePaste;
      ctrl.message      = message;
      ctrl.submit       = submit;
      ctrl.textInputIsEmpty = textInputIsEmpty;

      var addOne = function(queryText, user) {
        var q = queriesSvc.createQuery(queryText);

        queriesSvc.persistQuery(q)
          .then(function() {
            q.searchAndScore()
              .then(function success() {
                $rootScope.$emit('scoring-complete');
                flash.success = 'Query added successfully.';
              }, function error(errorMsg) {
                flash.error = 'Your new query had an error!';
                flash.to('search-error').error = errorMsg;
              });

            user.queryAdded();
            ctrl.loading = false;
          });
      };

      var addMany = function(queryTexts, user) {
        var queries = [];

        angular.forEach(queryTexts, function(queryText) {
          queries.push(queriesSvc.createQuery(queryText));
        });

        queriesSvc.persistQueries(queries)
          .then(function() {
            queriesSvc.searchAll()
              .then(function () {
                // searchAll emits its own 'scoring-complete' message, not needed here
                flash.success = 'Queries added successfully.';
              }, function (errorMsg) {
                flash.error = 'One (or many) of your new queries had an error!';
                flash.to('search-error').error = errorMsg;
              });

            user.queryAdded(queries.length);
            ctrl.loading = false;
          });
      };

      var userQueries = function(searchStrings) {
        return searchStrings;
      };

      var parseAddQuery = function(formInput) {
        var newQueries = [];

        angular.forEach(formInput.split(delim), function(newQuery) {
          var trimmed = newQuery.replace(/(^\s+|\s+$)/g,'');
          if (trimmed.length > 0) {
            newQueries.push(trimmed);
          }
        });

        return newQueries;
      };

      function textInputIsEmpty() {
        return (!ctrl.text || /^\s*$/.test(ctrl.text));
      }

      function submit () {
        if (textInputIsEmpty()) { return; }

        ctrl.loading = true;
        var initialSearchStrings  = parseAddQuery(ctrl.text);
        var searchStrings         = userQueries(initialSearchStrings, $rootScope.currentUser);

        if ( searchStrings.length === 1 ) {
          addOne(searchStrings[0], $rootScope.currentUser);
        } else if ( searchStrings.length > 1 ) {
          addMany(searchStrings, $rootScope.currentUser);
        }

        ctrl.text = '';
      }

      function handlePaste(pastedText) {
        $timeout(function() {
          ctrl.text = pastedText.split('\n').join(delim);
        });
      }

      function message() {
        return 'Add a query to this case';
      }
    }
  ]);

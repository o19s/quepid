'use strict';

/* jshint latedef:false */

angular.module('QuepidApp')
  .controller('AddQueryCtrl', [
    '$rootScope',
    '$timeout',
    '$log',
    'flash',
    'queriesSvc',
    'settingsSvc',
    function (
      $rootScope,
      $timeout,
      $log,
      flash,
      queriesSvc,
      settingsSvc
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
      ctrl.canAddQueries = true;
      
     

      var addOne = function(queryText) {
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
              }).then(function(){
                $log.info('rescoring queries after adding query');
                queriesSvc.updateScores();
              });

            ctrl.loading = false;
          });
      };

      var addMany = function(queryTexts) {
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
            ctrl.loading = false;
          });
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
        var searchStrings         = parseAddQuery(ctrl.text);

        if ( searchStrings.length === 1 ) {
          addOne(searchStrings[0]);
        } else if ( searchStrings.length > 1 ) {
          addMany(searchStrings);
        }

        ctrl.text = '';
      }

      function handlePaste(pastedText) {
        $timeout(function() {
          ctrl.text = pastedText.split('\n').join(delim);
        });
      }

      function message() {
        if (settingsSvc.isTrySelected() && settingsSvc.applicableSettings().searchEngine === 'static'){
          ctrl.canAddQueries = false;
        }
        if (ctrl.canAddQueries === true) {
          return 'Add a query to this case';
        }
        else {
          return 'Adding queries is not supported';
        }
      }
    }
  ]);

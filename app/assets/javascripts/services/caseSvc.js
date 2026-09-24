'use strict';

angular.module('QuepidApp')
  .service('caseSvc', [
    '$http', '$filter', '$q', '$rootScope',
    '$log',
    'caseTryNavSvc', 'queriesSvc', 'settingsSvc',
    'broadcastSvc',
    function caseSvc(
      $http, $filter, $q, $rootScope,
      $log,
      caseTryNavSvc, queriesSvc, settingsSvc,
      broadcastSvc
    ) {

      var cases = {};
      var selectedCase = null;
      var svc = this;

      svc.allCases          = [];
      this.dropdownCases    = [];
      svc.casesCount        = 0;

      // Functions
      svc.constructFromData = constructFromData;
      svc.get               = get;
      svc.getCases          = getCases;
      svc.refetchCaseLists  = refetchCaseLists;
      svc.runEvaluation     = runEvaluation;
      svc.saveDefaultScorer = saveDefaultScorer;
      svc.renameCase        = renameCase;
      svc.updateNightly     = updateNightly;
      svc.saveBookSettings  = saveBookSettings;

      // an individual case, ie
      // a search problem to be solved
      var Case = function(data) {
        var theCase               = this;

        theCase.caseNo            = data.case_id;
        theCase.lastTry           = data.last_try_number;
        theCase.caseName          = data.case_name;
        theCase.lastScore         = data.last_score;
        theCase.scorerId          = data.scorer_id;
        theCase.owned             = data.owned;
        theCase.ownerName         = data.owner_name;
        theCase.ownerId           = data.owner_id;
        theCase.bookId            = data.book_id;
        theCase.bookName          = data.book_name;
        theCase.autoPopulateBookPairs = data.auto_populate_book_pairs;
        theCase.autoPopulateCaseJudgements    = data.auto_populate_case_judgements;
        theCase.queriesCount      = data.queries_count;
        theCase.public            = data.public;
        theCase.archived          = data.archived;
        theCase.nightly           = data.nightly;
        theCase.teams             = data.teams || [];
        theCase.tries             = data.tries || [];
        theCase.scores            = data.scores || [];
        theCase.queries           = data.queries || [];

        theCase.teamNames = function() {
          var names = [];

          angular.forEach(theCase.teams, function(team) {
            names.push(team.name);
          });

          return names.join(', ');
        };

        theCase.fetchCaseScore = function() {
          // http GET api/cases/<int:caseId>/scores
          var url = 'api/cases/' + theCase.caseNo + '/scores';

          return $http.get(url)
            .then(function(response) {
              theCase.lastScore = response.data;

              return theCase;
            });
        };

        theCase.fetchCaseScores = function() {
          // http GET api/cases/<int:caseId>/scores/all
          var url = 'api/cases/' + theCase.caseNo + '/scores/all';

          return $http.get(url)
            .then(function(response) {
              theCase.scores = response.data.scores;

              return theCase;
            });
        };

        $rootScope.$on('settings-updated', function(event, args) {
          if ( args.caseNo === theCase.caseNo ) {
            theCase.lastTry = args.lastTry.tryNo;
          }
        });
      };

      $rootScope.$on('caseRenamed', function(event, args) {
        if ( svc.isCaseSelected() && args.caseNo === svc.getSelectedCase().caseNo ) {
          svc.getSelectedCase().caseName = args.caseName;
        }
      });

      /*
       * Server-rendered case header (app/views/core/_case_header.html.erb). Rename now happens
       * in Rails and re-renders a Turbo Frame, so this service never sees the PUT that
       * renameCase() used to make - without this bridge the in-memory case would keep the old
       * name until a full page load. (The recent-cases dropdown is its own Turbo Frame now too -
       * see _header_core_app.html.erb - and, like the Rails-page navbar's identical frame,
       * doesn't live-refresh on a rename either; that's existing cross-surface behavior, not
       * something this bridge needs to cover.)
       */
      document.addEventListener('case-header:renamed', function(event) {
        var detail = event.detail || {};
        var selected = svc.getSelectedCase();
        if (!svc.isCaseSelected() || !selected || Number(detail.caseNo) !== Number(selected.caseNo)) {
          return;
        }

        $rootScope.$applyAsync(function() {
          selected.caseName = detail.caseName;
          broadcastSvc.send('caseRenamed', selected);
        });
      });

      // Stimulus share-case (both Rails index/teams and the core toolbar).
      document.addEventListener('quepid:case-team-changed', function(event) {
        var detail = event.detail || {};
        var selected = svc.getSelectedCase();
        if (!svc.isCaseSelected() || !selected || Number(detail.caseNo) !== Number(selected.caseNo)) {
          return;
        }

        $rootScope.$applyAsync(function() {
          selected.teams = selected.teams || [];
          if (detail.action === 'added' && detail.team) {
            var already = selected.teams.some(function(t) {
              return Number(t.id) === Number(detail.team.id);
            });
            if (!already) {
              selected.teams.push(detail.team);
            }
          } else if (detail.action === 'removed' && detail.team) {
            selected.teams = selected.teams.filter(function(t) {
              return Number(t.id) !== Number(detail.team.id);
            });
          }
        });
      });

      // Stimulus judgements-core: keep the in-memory case book/sync settings in sync.
      document.addEventListener('judgements:book-settings-saved', function(event) {
        var detail = event.detail || {};
        var selected = svc.getSelectedCase();
        if (!svc.isCaseSelected() || !selected || Number(detail.caseId) !== Number(selected.caseNo)) {
          return;
        }

        $rootScope.$applyAsync(function() {
          selected.bookId = detail.bookId;
          selected.bookName = detail.bookName;
          selected.autoPopulateBookPairs = detail.autoPopulateBookPairs;
          selected.autoPopulateCaseJudgements = detail.autoPopulateCaseJudgements;
          broadcastSvc.send('associateBook', svc.dropdownBooks);
        });
      });

      this.selectCase = function(caseNo) {
        var cases = this.allCases.slice(); // shallow copy (dont create new cases)
        angular.forEach(cases, function(aCase) {
          if (aCase.caseNo === caseNo) {
            selectedCase = aCase;
          }
        });
      };

      this.selectTheCase = function(theCase) {
        selectedCase = theCase;
        broadcastSvc.send('caseSelected', selectedCase);
      };

      this.isCaseSelected = function() {
        return selectedCase !== null;
      };

      this.getSelectedCase = function() {
        return selectedCase;
      };

      this.createCase = function(caseName, queries, tries) {
        // http POST api/cases
        // returns as if we did HTTP GET /cases/<caseNo>
        // on success, sets current case number to case number
        var data = {'case_name': 'Case: ' + this.casesCount};
        if (caseName) {
          data.case_name = caseName;
        }
        if (queries) {
          data.queries = queries;
        }
        if (tries) {
          data.tries = tries;
        }
        var that = this;
        $http.post('api/cases', data)
          .then(function(response) {
            var newCase   = new Case(response.data);
            var caseTries = response.data.tries;

            that.allCases.push(newCase);
            var caseTryObj = {};
            caseTryObj.caseNo   = newCase.caseNo;
            caseTryObj.navTryNo = newCase.lastTry;

            // TODO: see if this is still necessary!
            settingsSvc.setSettings(caseTries, newCase.lastTry);
            caseTryNavSvc.navigateTo(caseTryObj);
          }, function(){
            caseTryNavSvc.notFound();
          });
      };


      this.deleteCase = function(caseToDelete) {
        var that        = this;
        var caseNumber  = caseToDelete.caseNo;

        return $http.delete('api/cases/' + caseNumber)
          .then(function() {
            that.refetchCaseLists();

            if( selectedCase !== null && selectedCase.caseNo === caseNumber ) {
              selectedCase = null;
            }
          });
      };

      this.deleteCaseQueries = function(caseToDeleteQueries) {
        var that        = this;
        var caseNumber  = caseToDeleteQueries.caseNo;

        return $http.delete('api/bulk/cases/' + caseNumber + '/queries/delete')
          .then(function() {
            that.refetchCaseLists();
            if( selectedCase !== null && selectedCase.caseNo === caseNumber ) {
              selectedCase = null;
            }
            queriesSvc.reset();
          });
      };

      this.archiveCase = function(caseToArchive) {
        var caseNumber  = caseToArchive.caseNo;
        var url         = 'api/cases/' + caseNumber;
        var data        = { archived: true };

        return $http.put(url, data)
          .then(function(response) {
            var data    = response.data;
            var newCase = new Case(data);

            // Mutate in place so Angular bindings keep their array reference.
            var indexOfCase = svc.allCases.findIndex(function (item) {
              return item.caseNo === newCase.caseNo;
            });
            if (indexOfCase !== -1) {
              svc.allCases.splice(indexOfCase, 1);
            }

          });
      };

      this.fetchDropdownCases = function() {
        var self = this;
        self.dropdownCases.length = 0;
        return $http.get('api/dropdown/cases')
          .then(function(response) {
            self.casesCount = response.data.cases_count;

            angular.forEach(response.data.all_cases, function(rawCase) {
              var newCase = new Case(rawCase);

              if ( !listContainsCase(svc.dropdownCases, newCase) ) {
                self.dropdownCases.push(newCase);
              }
            });

            broadcastSvc.send('fetchedDropdownCasesList', svc.allCases);
          });
      };
      


      this.trackLastViewedAt = function(caseNo) {
        var url         = 'api/cases/'+ caseNo + '/metadata';
        var dateFormat  = 'yyyy-MM-dd HH:mm:ss';
        var data        = {
          'metadata': {
            'last_viewed_at': $filter('date')(new Date(), dateFormat)
          }
        };

        return $http.put(url, data);
      };

      this.trackLastScore = function(caseNo, scoreData) {
        var self = this;

        if (  angular.isUndefined(scoreData.queries) ||
              scoreData.queries === null ||
              Object.keys(scoreData.queries).length === 0
        ) {
          return $q(function(resolve) {
            resolve();
          });
        }

        var url         = 'api/cases/'+ caseNo + '/scores';

        // Replace null values by an empty string for query scores,
        // in order to normalize values when score is not present:
        angular.forEach(scoreData.queries, function(score, id) {
          if (score === null || score === undefined || score === 'Null') {
            scoreData.queries[id] = '';
          }
        });

        var data = { 'case_score': scoreData };

        return $http.put(url, data)
          .then(function(response) {
            var caseExists = false;
            var theCase;

            angular.forEach(self.allCases, function(c) {
              if (c.caseNo === caseNo) {
                c.lastScore = response.data;
                caseExists  = true;
                theCase     = c;
              }
            });

            if ( !caseExists || angular.isUndefined(theCase) ) {
              theCase = {
                caseNo:     caseNo,
                lastScore:  response.data,
              };
            }

            document.dispatchEvent(new CustomEvent('case-score:persisted', {
              detail: { caseId: caseNo },
            }));
            return response;
          });
      };

      /*jslint latedef:false*/
      function getCases () {       
        // http GET api/cases
        var url = 'api/cases';

        svc.allCases.length = 0;
        return $http.get(url)
          .then(function(response) {
            var data = response.data;

            angular.forEach(data.all_cases, function(rawCase) {
              var newCase = constructFromData(rawCase);

              if ( !listContainsCase(svc.allCases, newCase) ) {
                svc.allCases.push(newCase);
              }
            });
          }, function() {
            caseTryNavSvc.notFound();
          });
      }



      function constructFromData(data) {
        return new Case(data);
      }

      /*
       * take a scorerId or null and send that information
       * to the server to save on a case
       */
      function saveDefaultScorer(caseId, scorerId) {
        // http PUT api/cases/<int:caseId>/scorers/<int:scorerId>
        scorerId  =  scorerId || 0;
        var url   = 'api/cases/' + caseId + '/scorers/' + scorerId;
        var data  = {};

        return $http.put(url, data)
          .then( function(response) {
            return response;
          });
      }

      /*
       * rename the case.  This could be refactored into a more
       * general "update" method.
       */
      function renameCase(theCase, newName) {
        if (newName.length > 0) {
          // http PUT api/cases/<int:caseId>
          var url  = 'api/cases/' + theCase.caseNo;
          var data = {
            case_name: newName
          };

          return $http.put(url, data)
            .then(function() {
              theCase.caseName = newName;
              broadcastSvc.send('caseRenamed', theCase);

              /*
               * The case header is server-rendered now (core/_case_header.html.erb), so a rename
               * made from Angular - the new-case wizard is the only remaining caller - has to ask
               * that Turbo Frame to re-render, or the heading keeps the old name until a reload.
               *
               * This does not loop with the inbound 'case-header:renamed' bridge above: that one
               * assigns caseName directly and never calls back into renameCase().
               */
              document.dispatchEvent(new CustomEvent('quepid:case-renamed', {
                detail: { caseNo: theCase.caseNo, caseName: newName }
              }));
            }, function() {
              caseTryNavSvc.notFound();
            });
        }
      }
      
      /*
       * update the recurrent status of the case.  This could be refactored into a more
       * general "update" method.
       */
      function updateNightly(theCase) {

        // http PUT api/cases/<int:caseId>
        var url  = 'api/cases/' + theCase.caseNo;
        var data = {
          nightly: theCase.nightly
        };

        return $http.put(url, data)
          .then(function() {
            broadcastSvc.send('caseUpdate', theCase);

            /*
             * The case header is server-rendered and shows the nightly indicator, so it cannot
             * see this change on its own. See app/views/core/_case_header.html.erb for the
             * contract this event belongs to.
             */
            document.dispatchEvent(new CustomEvent('quepid:case-header-stale', {
              detail: { caseNo: theCase.caseNo, reason: 'nightly' }
            }));
          }, function() {
            caseTryNavSvc.notFound();
          });

      }

      /*
       * Queues a background job to run all queries in the case and score the results.
       */
      function runEvaluation(caseNo, tryNumber) {
        // http POST api/cases/<int:caseId>/run_evaluation
        var url  = 'api/cases/' + caseNo + '/run_evaluation';
        var params = {};
        if (tryNumber) {
          params.try_number = tryNumber;
        }

        return $http.post(url, null, { params: params });
      }      

      /*
       * Save book association and sync settings in a single request.
       */
      function saveBookSettings(theCase, bookId, autoPopulateBookPairs, autoPopulateCaseJudgements) {
        var url  = 'api/cases/' + theCase.caseNo;
        var data = {
          book_id: bookId,
          auto_populate_book_pairs: bookId ? autoPopulateBookPairs : false,
          auto_populate_case_judgements: bookId ? autoPopulateCaseJudgements : false
        };

        return $http.put(url, data)
          .then(function(response) {
            theCase.bookId = bookId;
            theCase.bookName = response.data ? response.data.book_name : null;
            theCase.autoPopulateBookPairs = data.auto_populate_book_pairs;
            theCase.autoPopulateCaseJudgements = data.auto_populate_case_judgements;
            broadcastSvc.send('associateBook', svc.dropdownBooks);
          }, function() {
            caseTryNavSvc.notFound();
          });
      }

      function get(id, useCache) {
        // http GET api/cases/<int:caseId>
        var url  = 'api/cases/' + id;
        useCache = typeof useCache !== 'undefined' ?  useCache : true;

        var ccase = cases[id];
        if (useCache && ccase) {
          return $q(function(resolve) {
            resolve(ccase);
          });
        }
        else {
          return $http.get(url)
            .then(function(response) {
              var acase = constructFromData(response.data);
              cases[acase.id] = acase;

              var index = svc.allCases.indexOf( svc.allCases.filter( function (item) {
                return item.caseNo === acase.caseNo;
              })[0] );

              svc.allCases[index] = acase;
              return acase;
            }, function() {
              $log.info('Did not find the case ' + id);              
          });
        }
      }

      function refetchCaseLists () {
        return svc.getCases()
          .then(function () {
            return svc.fetchDropdownCases();
          });
      }

      function listContainsCase (list, c) {
        var check = list.filter(function(e) { return c.caseNo === e.caseNo; });

        return check.length > 0;
      }
    }
  ]);

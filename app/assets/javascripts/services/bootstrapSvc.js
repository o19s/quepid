'use strict';

/*jslint latedef:false*/
// This service gets us the current user and if we have a case/try then
// redirects us to the right location in the browser URL.

angular.module('UtilitiesModule')
  .service('bootstrapSvc', [
    '$http',
    '$location',
    '$rootScope',
    'userSvc', 'caseSvc', 'caseTryNavSvc',
    function bootstrapSvc($http, $location, $rootScope, userSvc, caseSvc, caseTryNavSvc) {
      var self = this;

      // Public Functions
      self.run = run;

      function run(caseNo, tryNo) {
        // Fetch the current user who is logged in
        userSvc.getCurrentUser()
          .then(function() {
            var user = userSvc.getUser();

            // Assign it so all controllers have access to the current user
            // instead of having to call the userSvc.getUser() function all the time.
            $rootScope.currentUser = user;

            if (user && angular.isDefined(caseNo) && angular.isDefined(tryNo)) {
              caseTryNavSvc.pathRequested({caseNo: caseNo, tryNo: tryNo});
            }
          });
      }
    }
  ]);

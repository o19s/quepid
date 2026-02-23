'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  .service('teamSvc', [
    '$http',
    'broadcastSvc',
    function teamSvc($http, broadcastSvc) {
      var self = this;
      
      self.teams = [];

      var Team = function(id, name, cases, members) {
        this.id      = id;
        this.name    = name;
        this.cases   = cases || [];
        this.members = members || [];

        // Normalize case data structure
        angular.forEach(this.cases, function(c) {
          c.caseNo = c.case_id;
          delete c.case_id;
          c.lastScore = c.last_score;
          delete c.last_score;
          c.caseName = c.case_name;
          delete c.case_name;
          c.ownerName = c.owner_name;
          delete c.owner_name;
          c.ownerId = c.owner_id;
          delete c.owner_id;
          c.lastTry = c.last_try_number;
          delete c.last_try_number;
          c.queriesCount = c.queries_count;
          delete c.queries_count;
        });
      };

      self.constructFromData = function(data) {
        return new Team(
          data.id,
          data.name,
          data.cases,
          data.members
        );
      };

      var contains = function(list, team) {
        return list.filter(function(item) { return item.id === team.id; }).length > 0;
      };

      self.list = function() {
        var url = 'api/teams';
        
        // Clear the list to get fresh data
        self.teams = [];

        return $http.get(url)
          .then(function(response) {
            angular.forEach(response.data.teams, function(dataTeam) {
              var team = self.constructFromData(dataTeam);

              if (!contains(self.teams, team)) {
                self.teams.push(team);
              }
            });
          });
      };

      self.shareCase = function(team, caseNo) {
        var url  = 'api/teams/' + team.id + '/cases';
        var data = { id: caseNo };

        return $http.post(url, data)
          .then(function(response) {
            team.cases.push(response.data);

            broadcastSvc.send('caseTeamAdded', {
              caseNo: caseNo,
              team:   team,
            });
          });
      };

      self.unshareCase = function(team, caseNo) {
        var url = 'api/teams/' + team.id + '/cases/' + caseNo;

        return $http.delete(url)
          .then(function() {
            // Remove case from team's cases array
            team.cases = team.cases.filter(function(c) {
              return c.caseNo !== caseNo;
            });

            broadcastSvc.send('caseTeamRemoved', {
              caseNo: caseNo,
              team:   team,
            });
          });
      };
    }
  ]);
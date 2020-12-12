'use strict';
/*jshint camelcase: false */

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('teamSvc', [
    '$http',
    'broadcastSvc',
    function teamSvc($http, broadcastSvc) {
      this.teams = [];

      var Team = function(id, name, ownerId, owner, cases, cases_count, members, scorers, owned) {
        this.id           = id;
        this.name         = name;
        this.ownerId      = ownerId;
        this.owner        = owner;
        this.cases        = cases;
        this.cases_count  = cases_count;
        this.members      = members;
        this.scorers      = scorers;
        this.owned        = owned;


        angular.forEach(this.cases, function(c) {
          // This is really ugly.
          c.caseName = c.case_name;
          c.lastTry  = c.last_try_number;
        });


      };

      this.constructFromData = function(data) {
        return new Team(
          data.id,
          data.name,
          data.owner_id,
          data.owner,
          data.cases,
          data.cases_count,
          data.members,
          data.scorers,
          data.owned
        );
      };

      var contains = function(list, team) {
        return list.filter(function(item) { return item.id === team.id; }).length > 0;
      };

      var hasMember = function(team, member) {
        return team.members.filter(function(item) { return item.id === member.id; }).length > 0;
      };

      this.create = function(name) {
        // http POST /api/teams
        var url   = '/api/teams';
        var data  = { 'name': name };
        var self  = this;

        return $http.post(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            self.teams.push(team);

            return team;
          });
      };

      this.edit = function(team) {
        // http PUT /teams/<int:teamId>
        var url   = '/api/teams/' + team.id;
        var data  = { 'name': team.name };
        var self  = this;

        return $http.put(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            return team;
          });
      };

      this.changeOwner = function(team, newOwnerId) {
        // http PUT /teams/<int:teamId>/owners/<int:id>
        var url   = '/api/teams/' + team.id + '/owners/' + newOwnerId;
        var data  = {};
        var self  = this;

        return $http.put(url, data)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            broadcastSvc.send('teamUpdated', team);

            return team;
          });
      };

      this.delete = function(team) {
        // http DELETE /api/teams/<int:teamId>
        var url   = '/api/teams/' + team.id;
        var self  = this;

        return $http.delete(url)
          .then(function() {
            self.teams.splice(self.teams.indexOf(team), 1);
          });
      };

      this.get = function(id, load_cases) {
        // http GET /api/teams/<int:teamId>
        var url   = '/api/teams/' + id;
        var self  = this;

        if ( load_cases ) {
          url += '?load_cases=true';
        }

        return $http.get(url)
          .then(function(response) {
            var team = self.constructFromData(response.data);

            return team;
          });
      };

      this.list = function(load_cases) {
        var url   = '/api/teams';
        var self  = this;

        if ( load_cases ) {
          url += '?load_cases=true';
        }

        // Clear the list just in case the data on the server changed,
        // we want to have the latest list.
        // TODO: write tests for this.
        self.teams = [];

        return $http.get(url)
          .then(function(response) {
            angular.forEach(response.data.teams, function(dataTeam) {
              var team = self.constructFromData(dataTeam);

              if(!contains(self.teams, team)) {
                self.teams.push(team);
              }
            });
          });
      };

      this.addMember = function(team, member) {
        // http POST /api/teams/<int:teamId>/members
        var url   = '/api/teams/' + team.id + '/members';
        var data  = { id:  member.id };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function() {
            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
          });
      };

      this.addMemberByEmail = function(team, email) {
        // http POST /api/teams/<int:teamId>/members
        var url   = '/api/teams/' + team.id + '/members';
        var data  = { id:  email };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function(response) {
            var member = response.data;

            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
          });
      };

      this.inviteUserToJoin = function(team, email) {
        // http POST /api/teams/<int:teamId>/members/invite
        var url   = '/api/teams/' + team.id + '/members/invite';
        var data  = { id:  email };

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.post(url, data)
          .then(function(response) {
            var member = response.data;

            if ( !hasMember(team, member) ) {
              team.members.push(member);
            }
          });
      };

      this.removeMember = function(team, member) {
        // http DELETE /api/teams/<int:teamId>/members/<int:memberId>
        var url   = '/api/teams/' + team.id + '/members/' + member.id;

        if ( team.members === undefined ) {
          team.members = [];
        }

        return $http.delete(url)
          .then(function() {
            team.members.splice(team.members.indexOf(member), 1);
          });
      };

      this.shareCase = function(team, caseNo) {
        // http POST /api/teams/<int:teamId>/cases
        var url   = '/api/teams/' + team.id + '/cases';
        var data  = { id: caseNo };

        return $http.post(url, data)
          .then(function(response) {
            team.cases.push(response.data);

            broadcastSvc.send('caseTeamAdded', {
              caseNo: caseNo,
              team:   team,
            });
          });
      };

      this.shareScorer = function(team, scorerId) {
        // http POST /api/teams/<int:teamId>/scorers
        var url   = '/api/teams/' + team.id + '/scorers';
        var data  = { id: scorerId };

        return $http.post(url, data)
          .then(function(response) {
            team.scorers.push(response.data);
          });
      };

      this.removeScorer = function(team, scorer) {
        // http DELETE /api/teams/<int:teamId>/scorers/<int:scorerId>
        var url   = '/api/teams/' + team.id + '/scorers/' + scorer.scorerId;

        if ( team.scorers === undefined ) {
          team.scorers = [];
        }

        return $http.delete(url)
          .then(function() {
            team.scorers.splice(team.scorers.indexOf(scorer), 1);
          });
      };
    }
  ]);

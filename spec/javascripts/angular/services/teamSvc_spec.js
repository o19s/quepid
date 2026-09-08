'use strict';

describe('Service: teamSvc share/unshare case', function () {
  beforeEach(module('QuepidTest'));

  var teamSvc;
  var $httpBackend;
  var $rootScope;
  var broadcastSvc;

  beforeEach(inject(function (_teamSvc_, $injector, _$rootScope_, _broadcastSvc_) {
    teamSvc = _teamSvc_;
    $httpBackend = $injector.get('$httpBackend');
    $rootScope = _$rootScope_;
    broadcastSvc = _broadcastSvc_;
  }));

  afterEach(function () {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  describe('list', function () {
    it('loads teams and normalizes nested case_id to caseNo', function () {
      $httpBackend.expectGET('api/teams').respond(200, {
        teams: [
          {
            id: 1,
            name: 'OSC',
            cases: [{ case_id: 5, case_name: 'Demo' }],
            members: []
          }
        ]
      });

      teamSvc.list();
      $httpBackend.flush();

      expect(teamSvc.teams.length).toBe(1);
      expect(teamSvc.teams[0].name).toBe('OSC');
      expect(teamSvc.teams[0].cases[0].caseNo).toBe(5);
      expect(teamSvc.teams[0].cases[0].case_id).toBeUndefined();
    });
  });

  describe('shareCase', function () {
    it('POSTs to api/teams/:id/cases and broadcasts caseTeamAdded', function () {
      var team = { id: 2, name: 'Other', cases: [] };
      var casePayload = { case_id: 5, case_name: 'Demo' };
      var sent;

      spyOn(broadcastSvc, 'send').and.callThrough();

      $httpBackend.expectPOST('api/teams/2/cases', { id: 5 }).respond(200, casePayload);

      teamSvc.shareCase(team, 5).then(function () {
        sent = true;
      });
      $httpBackend.flush();
      $rootScope.$digest();

      expect(sent).toBe(true);
      expect(team.cases.length).toBe(1);
      expect(broadcastSvc.send).toHaveBeenCalledWith('caseTeamAdded', {
        caseNo: 5,
        team: team
      });
    });
  });

  describe('unshareCase', function () {
    it('DELETEs api/teams/:id/cases/:caseNo and broadcasts caseTeamRemoved', function () {
      var team = {
        id: 1,
        name: 'OSC',
        cases: [{ caseNo: 5 }, { caseNo: 9 }]
      };
      var done;

      spyOn(broadcastSvc, 'send').and.callThrough();

      $httpBackend.expectDELETE('api/teams/1/cases/5').respond(204);

      teamSvc.unshareCase(team, 5).then(function () {
        done = true;
      });
      $httpBackend.flush();
      $rootScope.$digest();

      expect(done).toBe(true);
      expect(team.cases).toEqual([{ caseNo: 9 }]);
      expect(broadcastSvc.send).toHaveBeenCalledWith('caseTeamRemoved', {
        caseNo: 5,
        team: team
      });
    });
  });
});

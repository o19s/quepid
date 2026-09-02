'use strict';

describe('Controller: JudgementsModalInstanceCtrl', function () {

  beforeEach(module('QuepidTest'));

  var $rootScope, scope, modalInstance, Ctrl;
  var acase;

  beforeEach(function() {
    acase = {
      caseNo:                     42,
      caseName:                   'My Case',
      bookId:                     null,
      bookName:                   null,
      autoPopulateBookPairs:      false,
      autoPopulateCaseJudgements: true,
      queriesCount:               0,
      scorerId:                   7,
      teams:                      []
    };

    modalInstance = {
      close:   jasmine.createSpy('close'),
      dismiss: jasmine.createSpy('dismiss')
    };

    inject(function ($controller, _$rootScope_) {
      $rootScope = _$rootScope_;
      scope      = $rootScope.$new();

      Ctrl = $controller('JudgementsModalInstanceCtrl', {
        $scope:               scope,
        $quepidModalInstance: modalInstance,
        acase:                acase
      });
    });
  });

  describe('Initial state', function () {
    it('instantiates the controller properly', function () {
      expect(Ctrl).not.toBeUndefined();
      expect(Ctrl.share.acase).toBe(acase);
      expect(Ctrl.share.loading).toBe(false);
      expect(Ctrl.activeBookId).toBe(acase.bookId);
      expect(Ctrl.activeBookName).toBe(acase.bookName);
    });
  });

  describe('selectBook', function () {
    it('sets the active book when a book is chosen', function () {
      scope.selectBook({ id: 5, name: 'Great Book' });

      expect(Ctrl.activeBookId).toBe(5);
      expect(Ctrl.activeBookName).toBe('Great Book');
    });

    it('clears the active book when no book is chosen', function () {
      scope.selectBook({ id: 5, name: 'Great Book' });
      scope.selectBook(null);

      expect(Ctrl.activeBookId).toBe(null);
      expect(Ctrl.activeBookName).toBe(null);
    });
  });

  describe('hasUnsavedChanges', function () {
    it('is false when nothing has changed', function () {
      expect(Ctrl.hasUnsavedChanges()).toBe(false);
    });

    it('is true when the active book differs from the case book', function () {
      scope.selectBook({ id: 9, name: 'Another Book' });

      expect(Ctrl.hasUnsavedChanges()).toBe(true);
    });

    it('is true when the sync settings differ from the case settings', function () {
      Ctrl.autoPopulateBookPairs = true;

      expect(Ctrl.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('cancel', function () {
    it('dismisses the modal', function () {
      Ctrl.cancel();

      expect(modalInstance.dismiss).toHaveBeenCalledWith('cancel');
    });
  });

  describe('createNewBookLink', function () {
    it('builds a link to create a new book scoped to the case scorer and origin case', function () {
      var link = Ctrl.createNewBookLink();

      expect(link).toBe('books/new?scorer_id=7&origin_case_id=42');
    });
  });

  // Bridge added in place of the deleted Angular share-case modal: it hands
  // off to the new Stimulus share-case-core UI via a DOM CustomEvent.
  describe('openShareCase', function () {
    var dispatchedEvents;

    beforeEach(function() {
      dispatchedEvents = [];
      spyOn(document, 'dispatchEvent').and.callFake(function(event) {
        dispatchedEvents.push(event);
        return true;
      });

      // Defensive: strip any `.modal.show` elements other spec files may
      // have left behind, so the "no Angular modal open" branch below is
      // not accidentally satisfied (or defeated) by unrelated leftovers.
      angular.forEach(document.querySelectorAll('.modal.show'), function(el) {
        el.parentNode.removeChild(el);
      });
    });

    it('dispatches quepid:open-share-case-core immediately when no Angular modal is open', function () {
      Ctrl.openShareCase();

      expect(modalInstance.dismiss).not.toHaveBeenCalled();
      expect(document.dispatchEvent).toHaveBeenCalled();
      expect(dispatchedEvents.length).toBe(1);
      expect(dispatchedEvents[0].type).toBe('quepid:open-share-case-core');
      expect(dispatchedEvents[0].detail).toEqual({ caseNo: 42, caseName: 'My Case' });
    });

    describe('when the Angular judgements modal is open', function () {
      var modalEl;

      beforeEach(function() {
        modalEl = document.createElement('div');
        modalEl.className = 'modal show';
        document.body.appendChild(modalEl);
      });

      afterEach(function() {
        document.body.removeChild(modalEl);
      });

      it('dismisses the judgements modal and waits for it to hide before dispatching the event', function () {
        Ctrl.openShareCase();

        expect(modalInstance.dismiss).toHaveBeenCalledWith('cancel');
        expect(document.dispatchEvent).not.toHaveBeenCalled();

        modalEl.dispatchEvent(new CustomEvent('hidden.bs.modal'));

        expect(document.dispatchEvent).toHaveBeenCalled();
        expect(dispatchedEvents.length).toBe(1);
        expect(dispatchedEvents[0].type).toBe('quepid:open-share-case-core');
        expect(dispatchedEvents[0].detail).toEqual({ caseNo: 42, caseName: 'My Case' });
      });

      it('only dispatches once even if hidden.bs.modal fires more than once', function () {
        Ctrl.openShareCase();

        modalEl.dispatchEvent(new CustomEvent('hidden.bs.modal'));
        modalEl.dispatchEvent(new CustomEvent('hidden.bs.modal'));

        expect(dispatchedEvents.length).toBe(1);
      });
    });
  });

});

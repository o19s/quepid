'use strict';

describe('Factory: SnapshotFactory', function () {

  beforeEach(module('QuepidApp'));

  var SnapshotFactory;

  beforeEach(inject(function (_SnapshotFactory_) {
    SnapshotFactory = _SnapshotFactory_;
  }));

  describe('getQueryError', function () {
    it('returns null when the snapshot has no scores data at all', function () {
      var snapshot = new SnapshotFactory({ id: 1, time: new Date(), name: 'Test' });

      expect(snapshot.getQueryError(42)).toBeNull();
    });

    it('returns null when the matching query has no recorded error', function () {
      var snapshot = new SnapshotFactory({
        id:     1,
        time:   new Date(),
        name:   'Test',
        scores: [
          { query_id: 42, score: 0.5, number_of_results: 3, error: null }
        ]
      });

      expect(snapshot.getQueryError(42)).toBeNull();
    });

    it('returns the recorded error message for the matching query', function () {
      var snapshot = new SnapshotFactory({
        id:     1,
        time:   new Date(),
        name:   'Test',
        scores: [
          { query_id: 42, score: null, number_of_results: 0, error: 'JavaScript execution error: boom' },
          { query_id: 43, score: 0.8, number_of_results: 5, error: null }
        ]
      });

      expect(snapshot.getQueryError(42)).toBe('JavaScript execution error: boom');
      expect(snapshot.getQueryError(43)).toBeNull();
    });

    it('matches queryId regardless of string/number type', function () {
      var snapshot = new SnapshotFactory({
        id:     1,
        time:   new Date(),
        name:   'Test',
        scores: [
          { query_id: 42, error: 'boom' }
        ]
      });

      expect(snapshot.getQueryError('42')).toBe('boom');
    });
  });
});

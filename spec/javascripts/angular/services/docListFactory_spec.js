'use strict';

describe('Service: DocListFactory', function () {

  beforeEach(module('QuepidTest'));
  var DocListFactory, fieldSpecSvc;

  var mockResults = [
    {
      'id': '1234',
      'other_id': '1234',
    },
    {
      'id': '1235',
      'other_id': '1235',
    },
    {
      'id': '1236',
      'other_id': '1236',
    }
  ];

  var mockRatingsStore = {
    createRateableDoc: function(doc) {
      return doc;
    }
  };

  function buildMockDocs(mockResults) {
    angular.forEach(mockResults, function(result) {
      result.origin = function() {
        return this;
      };
      result.explain = function() {
        return {};
      };
    });
    return mockResults;
  }

  var idSet = function(array) {
    var obj = {};
    angular.forEach(array, function(value) {
      obj[value.id] = true;
    });
    return Object.keys(obj);
  };



  beforeEach(inject(function(_DocListFactory_, _fieldSpecSvc_) {
    DocListFactory = _DocListFactory_;
    fieldSpecSvc = _fieldSpecSvc_;
  }));

  it('builds docs with normal looking results', function() {
    var docs = buildMockDocs(mockResults);
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:id');

    var docList = new DocListFactory(docs, fieldSpec, mockRatingsStore);
    expect(docList.list().length).toBe(3);
    expect(docList.hasErrors()).toEqual(false);
    expect(docList.errorMsg()).toEqual('');
    expect(idSet(docList.list()).length).toEqual(docList.list().length);
  });

  it('reports errors on ids that are missing', function() {
    var docs = buildMockDocs(mockResults);
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:missing_id');

    var docList = new DocListFactory(docs, fieldSpec, mockRatingsStore);
    expect(docList.hasErrors()).toEqual(true);
    expect(docList.errorMsg().length).toBeGreaterThan(0);
    expect(docList.list().length).toBe(3);
    expect(docList.list()[0].error).toContain('Missing');
    expect(idSet(docList.list()).length).toEqual(docList.list().length);
  });

  it('reports errors on ids that have dups', function() {
    var docs = buildMockDocs(mockResults);
    docs = angular.copy(docs);
    docs[0].id = docs[1].id;
    var fieldSpec = fieldSpecSvc.createFieldSpec('id:id');

    var docList = new DocListFactory(docs, fieldSpec, mockRatingsStore);
    expect(docList.hasErrors()).toEqual(true);
    expect(docList.errorMsg().length).toBeGreaterThan(0);
    expect(docList.list().length).toBe(3);
    expect(docList.list()[1].error).toContain('Shared');
    expect(idSet(docList.list()).length).toEqual(docList.list().length);
  });


});

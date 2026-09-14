'use strict';

describe('Service: searchErrorTranslatorSvc', function () {

  beforeEach(module('QuepidTest'));

  var searchErrorTranslatorSvc;

  beforeEach(function() {
    inject(function (_searchErrorTranslatorSvc_) {
      searchErrorTranslatorSvc = _searchErrorTranslatorSvc_;
    });
  });

  describe('parseResponseObject', function () {
    it('returns the Solr-specific message for solr, regardless of response shape', function () {
      var msg = searchErrorTranslatorSvc.parseResponseObject({}, 'http://example.com', 'solr');

      expect(msg).toContain('Solr instance directly');
    });

    it('surfaces the .message of a thrown mapper Error instead of "undefined"', function () {
      var mapperError = new Error('MapperError: Attempting to run docsMapper failed: TypeError: Cannot read properties of undefined');

      var msg = searchErrorTranslatorSvc.parseResponseObject(mapperError, 'http://example.com', 'searchapi');

      expect(msg).toBe('Search API mapper error: ' + mapperError.message);
      expect(msg).not.toContain('undefined the search engine');
      expect(msg).not.toBe('An unexpected error was returned: undefined');
    });

    it('falls back to the generic HTTP response parsing for a real response object', function () {
      var response = { status: 500, statusText: 'Internal Server Error' };

      var msg = searchErrorTranslatorSvc.parseResponseObject(response, 'http://example.com', 'searchapi');

      expect(msg).toContain('500');
      expect(msg).toContain('Internal Server Error');
    });

    it('flags a status of -1 as a likely URL typo/CORS issue', function () {
      var response = { status: -1 };

      var msg = searchErrorTranslatorSvc.parseResponseObject(response, 'http://example.com', 'es');

      expect(msg).toContain('typo in your URL');
    });

    it('surfaces response.data.message (e.g. Algolia\'s {message, status} error shape)', function () {
      var response = {
        status: 400,
        statusText: 'Bad Request',
        data: { message: 'invalid setting for restrictSearchableAttributes, attribute cast is not in searchableAttributes setting', status: 400 }
      };

      var msg = searchErrorTranslatorSvc.parseResponseObject(response, 'http://example.com', 'algolia');

      expect(msg).toContain('invalid setting for restrictSearchableAttributes');
      expect(msg).not.toContain('undefined');
    });

    it('does not append the literal string "undefined" when response.data has neither .error nor .message', function () {
      var response = { status: 400, statusText: 'Bad Request', data: { status: 400 } };

      var msg = searchErrorTranslatorSvc.parseResponseObject(response, 'http://example.com', 'algolia');

      expect(msg).not.toContain('undefined');
    });
  });
});

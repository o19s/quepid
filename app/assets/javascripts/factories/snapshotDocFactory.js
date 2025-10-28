'use strict';

/*jslint latedef:false*/

(function() {
  angular.module('QuepidApp')
    .factory('SnapshotDocFactory', [
      'DocFactory',
      SnapshotDocFactory
    ]);

  function SnapshotDocFactory(DocFactory) {
    const Doc = function(doc, options) {
      DocFactory.call(this, doc, options);
      
      const self = this;

      angular.forEach(self.fieldsProperty(), function(fieldValue, fieldName) {
        if ( fieldValue !== null && fieldValue.constructor === Array && fieldValue.length === 1 ) {
          self[fieldName] = fieldValue[0];
        } else {
          self[fieldName] = fieldValue;
        }
      });
    };

    Doc.prototype = Object.create(DocFactory.prototype);
    Doc.prototype.constructor = Doc; // Reset the constructor
    Doc.prototype._url           = _url;
    Doc.prototype.origin         = origin;
    Doc.prototype.fieldsProperty = fieldsProperty;
    Doc.prototype.explain        = explain;
    Doc.prototype.snippet        = snippet;
    Doc.prototype.highlight      = highlight;

    function _url () {
      // no _url functionality implemented
      return null;
    }

    function origin () {
      /*jslint validthis:true*/
      var self = this;

      var src = {};
      angular.forEach(self.doc.doc, function(value, field) {
        if (!angular.isFunction(value)) {
          src[field] = value;
        }
      });
      delete src.doc;
      return src;
    }

    function fieldsProperty() {
      /*jslint validthis:true*/
      //const self = this.doc;
      //return self;
      // this is weird and maybe should be more than just id?
      return ['id'];
    }

    function explain () {
      // no explain functionality implemented
      return {};
    }

    function snippet () {
      // no snippet functionality implemented
      return null;
    }

    function highlight () {
      // no highlighting functionality implemented
      return null;
    }

    return Doc;
  }
})();

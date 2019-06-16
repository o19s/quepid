'use strict';
if (typeof String.prototype.contains !== 'function') {
  String.prototype.contains = function(str) {
    return this.indexOf(str) !== -1;
  };
}
// jshint ignore: start
var pass = function() {
  throw 100;
};

var fail = function() {
  throw 0;
};

var setScore = function(score) {
  throw score;
};

var assert = function(cond) {
};

var assertOrScore = function(cond, score) {
};
onmessage = function(oEvent) {
  var code = oEvent.data.code;
  var docs = oEvent.data.docs;
  try {
    resp = eval(code);
  } catch (e) {
  }
  postMessage('done!');
};

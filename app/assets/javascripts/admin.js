'use strict';

//= require bootstrap/dist/js/bootstrap.bundle
//= require rails-ujs
//= require jquery

//= require d3
//= require cal-heatmap

//= require codemirror/lib/codemirror
//= require codemirror/mode/javascript/javascript

//= require @rails/actioncable

/* sample code below for ActionCable */

/* jshint ignore:start */
(function() {
  this.App || (this.App = {});

  App.cable = ActionCable.createConsumer();
}).call(this);




this.channel = App.cable.subscriptions.create({channel: 'RatingChannel', case_id:8}, {
    connected: function () {
      console.log('here');
    },
    disconnected: function () {
      console.log('gone');
    },
    received: function (data) {
      console.log('Got something');
      console.log(data);
    }
});

/* jshint ignore:end */

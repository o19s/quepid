//= require bootstrap/dist/js/bootstrap.bundle
//= require rails-ujs
//= require jquery

//= require d3
//= require cal-heatmap

//= require codemirror/lib/codemirror
//= require codemirror/mode/javascript/javascript

//= require @rails/actioncable
(function() {
  this.App || (this.App = {});

  App.cable = ActionCable.createConsumer();
}).call(this);



this.channel = App.cable.subscriptions.create({channel: 'StatChannel', case:8}, {
    connected: function () {
      console.log('here')
    },
    disconnected: function () {
      console.log('gone')
    },
    received: function (data) {
      console.log("GOt somethign")
      console.log(data)
    }
})

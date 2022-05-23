// NOTE NOT USED TODAY BECAUSE WE ARE SOMEHOW NOT HIP WIHT THIS BUILD TOOL AND MORE LIKE RAILS 5
import consumer from "./consumer"

consumer.subscriptions.create("RatingChannel", {
  connected() {
    // Called when the subscription is ready for use on the server
  },

  disconnected() {
    // Called when the subscription has been terminated by the server
  },

  received(data) {
    // Called when there's incoming data on the websocket for this channel
  },

  caseupdate: function() {
    return this.perform('caseupdate');
  },

  ratingsinprogress: function() {
    return this.perform('ratingsinprogress');
  },

  ratingsdone: function() {
    return this.perform('ratingsdone');
  }
});

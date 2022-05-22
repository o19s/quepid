'use strict';

angular.module('QuepidApp')
  // Manages connections to rails ActionCable
  .service('cableSvc', [
    '$rootScope',
    '$q',
    'ActionCableChannel', function cableSvc($rootScope, $q, ActionCableChannel) {
      var svc = this;

      svc.promises = {};

      svc.remoteQueryConsumer = null;

      svc.registerPromise   = registerPromise;
      svc.requestQuery      = requestQuery;
      svc.setupSubscription = setupSubscription;
      svc.unsubscribe       = unsubscribe;

      function registerPromise(queryId, promise) {
        svc.promises[queryId] = promise;
      }

      /*
       * Request remote execution of queries via websocket
       */
      function requestQuery(meta) {
        if (svc.remoteQueryConsumer) {
          console.log('Requesting remote query execution.');
          svc.remoteQueryConsumer.send(meta, 'new_job');
        }
      }

      /*
       * Setup ActionCable subscription
       */
      function setupSubscription(caseID) {
        return svc.unsubscribe().then(function() {
          // Remote Query consumer mgmt
          svc.remoteQueryConsumer = new ActionCableChannel('QueryChannel', {
            'case_id': caseID
          });

          var queryCallback = function(payload) {
            switch (payload.type) {
              case 'heartbeat':
                console.log('Heartbeat from query executor');
                break;
              case 'complete':
                console.log('Query Job complete.');

                if (svc.promises.hasOwnProperty(payload.query_id)) {
                  svc.promises[payload.query_id].resolve(payload.resp);
                  delete svc.promises[payload.query_id];
                }

                break;
              default:
                console.log('Unsupported message type');
            }
          };

          console.log('Setting up new subscription', caseID);
          return svc.remoteQueryConsumer.subscribe(queryCallback)
        });
      }

      function unsubscribe() {
        if (svc.remoteQueryConsumer) {
          return svc.remoteQueryConsumer.unsubscribe().then(function() {
            svc.remoteQueryConsumer = null;
          });
        } else {
          return $q.resolve();
        }
      }
    }
  ]);

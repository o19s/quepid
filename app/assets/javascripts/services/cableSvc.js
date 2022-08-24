'use strict';

angular.module('QuepidApp')
  // Manages connections to rails ActionCable
  .service('cableSvc', [
    '$rootScope',
    '$q',
    'ActionCableChannel',
    'userSvc', function cableSvc($rootScope, $q, ActionCableChannel, userSvc) {
      var svc = this;

      svc.HEARTBEAT_LIMIT = 2000;

      svc.promises = {};
      svc.lastHeartbeat = Date.now();

      svc.remoteQueryConsumer = null;

      svc.checkHeartbeat    = checkHeartbeat;
      svc.registerPromise   = registerPromise;
      svc.requestQuery      = requestQuery;
      svc.sendHeartbeat     = sendHeartbeat;
      svc.setupSubscription = setupSubscription;
      svc.unsubscribe       = unsubscribe;

      function checkHeartbeat() {
        return (Date.now() - svc.lastHeartbeat) < svc.HEARTBEAT_LIMIT;
      }

      function sendHeartbeat(caseNo) {
        if (svc.remoteQueryConsumer) {
          svc.remoteQueryConsumer.send({
            'user_id': userSvc.getUser().id,
            'case_id': caseNo
          }, 'heartbeat');
        }
      }

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
                svc.lastHeartbeat = Date.now();
                break;
              case 'complete':
                if (svc.promises.hasOwnProperty(payload.query_id)) {
                  svc.promises[payload.query_id].resolve(payload.resp);
                  delete svc.promises[payload.query_id];
                }

                break;
              default:
                console.log('Unsupported message type');
            }
          };

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

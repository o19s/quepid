import requests
import time

from actioncable.connection import Connection
from actioncable.message import Message
from actioncable.subscription import Subscription

connection = Connection(url='ws://localhost:3000/cable')
connection.connect()

subscription = Subscription(connection, identifier={
    'channel': 'QompanionChannel',
    'data': {
        'user_id': 1 # 1 is admin user, may eventually do token auth or something to fetch this
    }
})

def handle_heartbeat(data):
    heartbeat = Message(
        action='heartbeat',
        data={
            'case_id': data['case_id']
        }
    )
    subscription.send(heartbeat)

def handle_query(data):
    print('Running query: {}'.format(data['query']))

    resp = requests.get(data['href']).json()
    message = Message(
            action='query_complete',
            data={
                'case_id': data['case_id'],
                'query_id': data['query_id'],
                'resp': resp
            }
    )
    subscription.send(message)


def message(data):
    if data['type'] == 'heartbeat':
        handle_heartbeat(data)
    elif data['type'] == 'new':
        handle_query(data)

subscription.on_receive(callback=message)
subscription.create()

print('Waiting for queries from quepid, press CTRL-C to exit.');

while True:
    time.sleep(0.5)
    pass

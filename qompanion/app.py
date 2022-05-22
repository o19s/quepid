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

def message(data):
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

subscription.on_receive(callback=message)
subscription.create()

print('Waiting for queries from quepid, press CTRL-C to exit.');
while True:
    time.sleep(0.25)
    pass

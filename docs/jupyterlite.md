# Jupyterlite

We package up Jupyterlite notebooks to work with Quepid via the https://github.com/o19s/quepid-jupyterlite repository.

For development we have a `bin/setup_jupyterlite` script that grabs the release and dumps it locally.   

For prod, we bake the files in as part of building the image.

On Heroku, we grab the version and deploy it.   The version is specified in `app.json`.



### Old Stuff
https://github.com/innovationOUtside/ouseful_jupyterlite_utils

From https://jupyterlite.readthedocs.io/en/latest/user-guide.html#how-can-i-read-content-from-python

```
import pandas as pd
from js import fetch

URL = "https://yourdomain.com/path/to/file.csv"

res = await fetch(URL)
text = await res.text()

filename = 'data.csv'

with open(filename, 'w') as f:
    f.write(text)

data = pd.read_csv(filename, sep=';')
data
```

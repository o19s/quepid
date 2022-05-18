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

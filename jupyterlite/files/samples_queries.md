# Sample code.

Starting up the Python Kernal in your browser can take a while, so do a `1+1` first to trigger all of that!

## How to load a useful utils library in!

import pyodide

# Load in the contents of `ouseful_jupyterlite_utils/utils` package from a remote URL:

URL = "https://raw.githubusercontent.com/innovationOUtside/ouseful_jupyterlite_utils/main/ouseful_jupyterlite_utils/utils.py"
exec(pyodide.open_url(URL).read())



##  How to load data from csv url into dataframe.

from ouseful_jupyterlite_utils import pandas_utils as pdu

# Load CSV from URL
# Via @jtpio
URL = "https://support.staffbase.com/hc/en-us/article_attachments/360009197031/username.csv"
df = await pdu.read_csv_url(URL, sep=";") # Pass separator, if required, as second parameter


http://localhost/api/cases/6/snapshots/1.json


## Load a snapshot
_which you need to create first if you want doc ids.  We only snapshot rated docs!  So chase the frogs!_
```
from js import fetch
import pandas as pd

res = await fetch('https://localhost/api/cases/7/snapshots/4.json')
snapshot = await res.json()
queriesDocs = [];

deepestRanking = 0
#columns = ['query','rank0','rank1','rank2','rank3','rank4','rank5','rank6','rank7','rank8','rank9']
columns = ['query']
for snapshotQuery in snapshot.queries:
    depthOfRanking= snapshotQuery.ratings.object_keys().length
    if depthOfRanking > deepestRanking:
        deepestRanking = depthOfRanking
    queryDoc = snapshotQuery.ratings.object_keys().to_py()
    queryDoc.insert(0, snapshotQuery.query_text)
    queriesDocs.append(queryDoc)


for x in range(deepestRanking):
  columns.append(x)


df = pd.DataFrame(columns=columns, data=queriesDocs)
df
```


## Read File

```
# Cell One
import js
from io import StringIO
import pandas as pd
op = js.self.indexedDB.open("JupyterLite Storage")

# Cell Two
idbdb = op.result
tr = idbdb.transaction("files")
obs = tr.objectStore("files")

# Cell Three
req = obs.get("bcomplex.json", "key")

# Cell Four
bcomplex = req.result.content
bcomplex
```

Maybe...

```
# Cell One
import js
from io import StringIO
import pandas as pd
op = js.self.indexedDB.open("JupyterLite Storage")

# Cell Two
idbdb = op.result
tr = idbdb.transaction("files")
obs = tr.objectStore("files")
req = obs.get("bcomplex.json", "key")

# Cell Three
bcomplex = req.result.content
bcomplex

```

import js
from io import StringIO
import pandas as pd
op = js.self.indexedDB.open("JupyterLite Storage")
idbdb = op.result
tr = idbdb.transaction("files")
obs = tr.objectStore("files")
req = obs.get("bcomplex.json", "key")

# Cell Three
bcomplex = req.result.content
bcomplex

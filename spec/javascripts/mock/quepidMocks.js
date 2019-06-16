quepidMocks  =
{

  tryBootstrap: {

  'displayOrder': [5,1,0,2,3],

  "preparedQueries": {
    "0": {
      "callUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=symptoms+of+heart+attack&wt=json&debugQuery=true&fl=catch_line%2Cid",
      "linkUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=symptoms+of+heart+attack&debugQuery=true&fl=catch_line%2Cid",
      "queryId": 0,
      "queryText": "symptoms of heart attack",
      "result": "",
      "args": {
        "q": [
          "#$query##"
        ]
      },
      "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
      "titleField": "catch_line"
    },
    "1": {
      "callUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=how+is+kidney+cancer+diagnosed&wt=json&debugQuery=true&fl=catch_line%2Cid",
      "linkUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=how+is+kidney+cancer+diagnosed&debugQuery=true&fl=catch_line%2Cid",
      "queryId": 1,
      "queryText": "how is kidney cancer diagnosed",
      "result": "",
      "args": {
        "q": [
          "#$query##"
        ]
      },
      "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
      "titleField": "catch_line"
    },
    "2": {
      "callUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=prognosis+of+alzheimers&wt=json&debugQuery=true&fl=catch_line%2Cid",
      "linkUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=prognosis+of+alzheimers&debugQuery=true&fl=catch_line%2Cid",
      "queryId": 2,
      "queryText": "prognosis of alzheimers",
      "result": "",
      "args": {
        "q": [
          "#$query##"
        ]
      },
      "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
      "titleField": "catch_line"
    },
    "3": {
      "callUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=toe+cancer&wt=json&debugQuery=true&fl=catch_line%2Cid",
      "linkUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=toe+cancer&debugQuery=true&fl=catch_line%2Cid",
      "queryId": 3,
      "queryText": "toe cancer",
      "result": "",
      "args": {
        "q": [
          "#$query##"
        ]
      },
      "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
      "titleField": "catch_line"
    },
    "5": {
      "callUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=foot&wt=json&debugQuery=true&fl=catch_line%2Cid",
      "linkUrl": "http://solr.quepid.com/solr/statedecoded/search?indent=true&echoParams=all&q=foot&debugQuery=true&fl=catch_line%2Cid",
      "queryId": 5,
      "queryText": "foot",
      "result": "",
      "args": {
        "q": [
          "#$query##"
        ]
      },
      "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
      "titleField": "catch_line"
    }
  },
  "queriesWithRatings": {
    "0": {
      "deleted": "false",
      "query_text": "symptoms of heart attack",
      "section39296157": "4",
      "section41376273": "6",
      "section41392293": "3",
      "section41606534": "9",
      "section41606535": "1",
      "section41618414": "10",
      "section42664474": "10"
    },
    "1": {
      "deleted": "false",
      "query_text": "how is kidney cancer diagnosed",
      "section40909392": "1"
    },
    "2": {
      "deleted": "false",
      "query_text": "prognosis of alzheimers"
    },
    "3": {
      "deleted": "false",
      "query_text": "toe cancer"
    },
    "4": {
      "deleted": "true",
      "query_text": "schnoue"
    },
    "5": {
      "deleted": "false",
      "query_text": "foot"
    }
  },
  "queryParamsHistory": [
    {
      "curatorVars": "{}",
      "queryParams": "q=#$query##"
    },
    {
      "curatorVars": "{}",
      "queryParams": "q=#$query##bq=question:tongue^##tongueboost##"
    },
    {
      "curatorVars": "{\"blarg\":\"31\"}",
      "queryParams": "q=#$query##&test=##blarg##"
    }
  ],
  "searchUrl": "http://solr.quepid.com/solr/statedecoded/search",
  "titleField": "catch_line"

  }
};

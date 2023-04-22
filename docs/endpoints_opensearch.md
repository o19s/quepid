# OpenSearch Endpoints Structure

This document explains what endpoints Quepid hits on OpenSearch.

Quepid connects to OpenSearch using standard RESTful calls.   
You need to have CORS set up to allow Quepid on one domain talk to OpenSearch on another domain.
One interesting thing is that if OpenSearch is running on HTTPS, then Quepid needs to run on HTTPS as well, so you may be prompted to reload Quepid using the right security protocol.


## Ping OpenSearch During Case Setup

Quepid checks that that OpenSearch is available and responding during the Case Setup Wizard, and if not
then Quepid attempts to provide you some workarounds.  You can bypass this check as well, and then
fix your connectivity setup yourself in the Case Settings window ;-).

Request
```
POST https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search

{
  "explain": true,
  "profile": true,
  "_source": "*",
  "highlight": {
    "fields": {
      "*": {}
    }
  },
  "from": 0,
  "size": 10
}

```

The `explain`, `profile`, and `highlight` parameters are just tacked on automatically, but aren't actually used.  
The `_source` parameter is used to get a list of all possible fields back so we can populate the field picking UI in Quepid.

Response Format

```
{
  "took": 1,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "skipped": 0,
    "failed": 0
  },
  "hits": {
    "total": {
      "value": 8516,
      "relation": "eq"
    },
    "max_score": 1,
    "hits": [
      {
        "_shard": "[tmdb][0]",
        "_node": "CAA3PraQTDm1ZB8rbP5LIg",
        "_index": "tmdb",
        "_id": "43004",
        "_score": 1,
        "_source": {
          "overview": "The film follows one day in the lives of the Tyrone family, each member is troubled and has been damaged by alcohol and/or drugs. In addition, they have issues with each other that lead to fights and an inability to reconcile completely with one another.",
          "cast": "Katharine Hepburn Ralph Richardson Jason Robards Dean Stockwell Jeanne Barr",
          "revenue": 0,
          "release_date": "1962-10-09T00:00:00Z",
          "genres": [
            "Drama",
            "History"
          ],
          "directors": [
            "Sidney Lumet"
          ],
          "vote_average": 6.9,
          "tagline": "PRIDE...POWER...PASSION...PAIN!",
          "id": "43004",
          "title": "Long Day's Journey Into Night",
          "vote_count": 25,
          "poster_path": "https://image.tmdb.org/t/p/w185/v0LN26HmrCEgZiDGpO3xJGkb9OK.jpg"
        },
        "_explanation": {
          "value": 1,
          "description": "*:*",
          "details": []
        }
      },
      {
        "_shard": "[tmdb][0]",
        "_node": "CAA3PraQTDm1ZB8rbP5LIg",
        "_index": "tmdb",
        "_id": "43012",
        "_score": 1,
        "_source": {
          "overview": "Ukraine, 16th century. While the Poles dominate the Cossack steppes, Andrei, son of Taras Bulba, a Cossack leader, must choose between his love for his family and his folk and his passion for a Polish woman.",
          "cast": "Tony Curtis Yul Brynner Christine Kaufmann Sam Wanamaker Brad Dexter Guy Rolfe Perry Lopez George Macready Ilka Windish Vladimir Sokoloff Vladimir Irman Daniel Ocko Abraham Sofaer Mickey Finn Richard Rust Ron Weyand Vitina Marcus Paul Frees",
          "revenue": 4000000,
          "release_date": "1962-11-21T00:00:00Z",
          "genres": [
            "Adventure",
            "Romance",
            "History",
            "War",
            "Drama"
          ],
          "directors": [
            "J. Lee Thompson"
          ],
          "vote_average": 6.8,
          "tagline": "A love story of flesh and fire!",
          "id": "43012",
          "title": "Taras Bulba",
          "vote_count": 35,
          "poster_path": "https://image.tmdb.org/t/p/w185/8bnn12yMugSBIKlrhSuCOVJKrgH.jpg"
        },
        "_explanation": {
          "value": 1,
          "description": "*:*",
          "details": []
        }
      }
    ]
  }
}
```



## Queries

Queries are sent off to OpenSearch using the standard POST request handler.


Request

```
POST https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search

{
  "query": {
    "multi_match": {
      "query": "star wars",
      "type": "best_fields",
      "fields": [
        "title^10",
        "overview",
        "cast"
      ]
    }
  },
  "explain": true,
  "profile": true,
  "_source": [
    "_id",
    "title",
    "poster_path",
    "overview",
    "cast"
  ],
  "highlight": {
    "fields": {
      "title": {},
      "poster_path": {},
      "overview": {},
      "cast": {}
    }
  },
  "from": 0,
  "size": 10
}
```

Quepid adds some parameters:

1. `query` JSON block comes from the Query Pane in the UI.
1. `_source` JSON block comes from the Settings Pane in the UI.
1. `explain=true` is used to get back the query explain information.  If this isn't available, that is fine, you just don't get the information about how the query matched the docs in the UI.
1. `echoParams=all` lets us return all the params used in constructing the query to show in the UI.  You can override this via passing in `echoParams=none`.
1. `profile=true` is used to get back the performance information.  I don't know that we are using this today in Quepid....
1. `highlight` asks for highlighting on certain fields, but not sure that this is being used.
1. `size=10` is driven by the Settings Pane in the UI.
1. `from=0` is added when you start to paginate through the results.

Response

```
{
  "took": 12,
  "timed_out": false,
  "_shards": {
    "total": 1,
    "successful": 1,
    "skipped": 0,
    "failed": 0
  },
  "hits": {
    "total": {
      "value": 781,
      "relation": "eq"
    },
    "max_score": 107.58037,
    "hits": [
      {
        "_shard": "[tmdb][0]",
        "_node": "CAA3PraQTDm1ZB8rbP5LIg",
        "_index": "tmdb",
        "_id": "11",
        "_score": 107.58037,
        "_source": {
          "overview": "Princess Leia is captured and held hostage by the evil Imperial forces in their effort to take over the galactic Empire. Venturesome Luke Skywalker and dashing captain Han Solo team together with the loveable robot duo R2-D2 and C-3PO to rescue the beautiful princess and restore peace and justice in the Empire.",
          "cast": "Mark Hamill Harrison Ford Carrie Fisher Peter Cushing Alec Guinness Anthony Daniels Kenny Baker Peter Mayhew David Prowse James Earl Jones Phil Brown Shelagh Fraser Jack Purvis Alex McCrindle Eddie Byrne Drewe Henley Denis Lawson Garrick Hagon Jack Klaff William Hootkins Angus MacInnes Jeremy Sinden Graham Ashley Don Henderson Richard LeParmentier Leslie Schofield Michael Leader David Ankrum Mark Austin Scott Beach Lightning Bear Jon Berg Doug Beswick Paul Blake Janice Burchette Ted Burnett John Chapman Gilda Cohen Tim Condren Barry Copping Alfie Curtis Robert Davies Maria De Aragon Robert A. Denham Frazer Diamond Peter Diamond Warwick Diamond Sadie Eden Kim Falkinburg Harry Fielder Ted Gagliano Salo Gardner Steve Gawley Barry Gnome Rusty Goffe Isaac Grand Nelson Hall Reg Harding Alan Harris Frank Henson Christine Hewett Arthur Howell Tommy Ilsley Joe Johnston Annette Jones Linda Jones Joe Kaye Colin Michael Kitchens Melissa Kurtz Tiffany L. Kurtz Al Lampert Anthony Lang Laine Liska Derek Lyons Mahjoub Alf Mangan Rick McCallum Grant McCune Geoffrey Moon Mandy Morton Lorne Peterson Marcus Powell Shane Rimmer Pam Rose George Roubicek Erica Simmons Angela Staines George Stock Roy Straite Peter Sturgeon Peter Sumner John Sylla Tom Sylla Malcolm Tierney Phil Tippett Burnell Tucker Morgan Upton Jerry Walter Hal Wamsley Larry Ward Diana Sadley Way Harold Weed Bill Weston Steve 'Spaz' Williams Fred Wood Colin Higgins Ron Tarr",
          "title": "Star Wars",
          "poster_path": "https://image.tmdb.org/t/p/w185/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg"
        },
        "highlight": {
          "title": [
            "<em>Star</em> <em>Wars</em>"
          ]
        },
        "_explanation": {
          "value": 107.58037,
          "description": "max of:",
          "details": [
            {
              "value": 107.58037,
              "description": "sum of:",
              "details": [
                {
                  "value": 54.016174,
                  "description": "weight(title:star in 1153) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 54.016174,
                      "description": "score(freq=1.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 22,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 5.253978,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 44,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8513,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.46731842,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 1,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 2,
                              "description": "dl, length of field",
                              "details": []
                            },
                            {
                              "value": 2.1431928,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "value": 53.56419,
                  "description": "weight(title:war in 1153) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 53.56419,
                      "description": "score(freq=1.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 22,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 5.210015,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 46,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8513,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.46731842,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 1,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 2,
                              "description": "dl, length of field",
                              "details": []
                            },
                            {
                              "value": 2.1431928,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      },
      {
        "_shard": "[tmdb][0]",
        "_node": "CAA3PraQTDm1ZB8rbP5LIg",
        "_index": "tmdb",
        "_id": "12180",
        "_score": 96.39314,
        "_source": {
          "overview": "Set between Episode II and III, The Clone Wars is the first computer animated Star Wars film. Anakin and Obi Wan must find out who kidnapped Jabba the Hutt's son and return him safely. The Seperatists will try anything to stop them and ruin any chance of a diplomatic agreement between the Hutts and the Republic.",
          "cast": "Matt Lanter Ashley Eckstein James Arnold Taylor Dee Bradley Baker Tom Kane Nika Futterman Ian Abercrombie Corey Burton Catherine Taber Matthew Wood Kevin Michael Richardson David Acord Samuel L. Jackson Anthony Daniels Christopher Lee",
          "title": "Star Wars: The Clone Wars",
          "poster_path": "https://image.tmdb.org/t/p/w185/d6YOfi0T9GowglzIkDQGGvGYVTM.jpg"
        },
        "highlight": {
          "overview": [
            "Set between Episode II and III, The Clone <em>Wars</em> is the first computer animated <em>Star</em> <em>Wars</em> film."
          ],
          "title": [
            "<em>Star</em> <em>Wars</em>: The Clone <em>Wars</em>"
          ]
        },
        "_explanation": {
          "value": 96.39314,
          "description": "max of:",
          "details": [
            {
              "value": 96.39314,
              "description": "sum of:",
              "details": [
                {
                  "value": 38.791183,
                  "description": "weight(title:star in 1818) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 38.791183,
                      "description": "score(freq=1.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 22,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 5.253978,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 44,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8513,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.33560014,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 1,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 4,
                              "description": "dl, length of field",
                              "details": []
                            },
                            {
                              "value": 2.1431928,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "value": 57.601963,
                  "description": "weight(title:war in 1818) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 57.601963,
                      "description": "score(freq=2.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 22,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 5.210015,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 46,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8513,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.50254583,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 2,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 4,
                              "description": "dl, length of field",
                              "details": []
                            },
                            {
                              "value": 2.1431928,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "value": 7.0881844,
              "description": "sum of:",
              "details": [
                {
                  "value": 3.2052264,
                  "description": "weight(overview:star in 1818) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 3.2052264,
                      "description": "score(freq=1.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 2.2,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 3.391846,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 286,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8514,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.42953634,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 1,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 40,
                              "description": "dl, length of field (approximate)",
                              "details": []
                            },
                            {
                              "value": 35.016327,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "value": 3.882958,
                  "description": "weight(overview:war in 1818) [PerFieldSimilarity], result of:",
                  "details": [
                    {
                      "value": 3.882958,
                      "description": "score(freq=2.0), computed as boost * idf * tf from:",
                      "details": [
                        {
                          "value": 2.2,
                          "description": "boost",
                          "details": []
                        },
                        {
                          "value": 2.9370093,
                          "description": "idf, computed as log(1 + (N - n + 0.5) / (n + 0.5)) from:",
                          "details": [
                            {
                              "value": 451,
                              "description": "n, number of documents containing term",
                              "details": []
                            },
                            {
                              "value": 8514,
                              "description": "N, total number of documents with field",
                              "details": []
                            }
                          ]
                        },
                        {
                          "value": 0.600945,
                          "description": "tf, computed as freq / (freq + k1 * (1 - b + b * dl / avgdl)) from:",
                          "details": [
                            {
                              "value": 2,
                              "description": "freq, occurrences of term within document",
                              "details": []
                            },
                            {
                              "value": 1.2,
                              "description": "k1, term saturation parameter",
                              "details": []
                            },
                            {
                              "value": 0.75,
                              "description": "b, length normalization parameter",
                              "details": []
                            },
                            {
                              "value": 40,
                              "description": "dl, length of field (approximate)",
                              "details": []
                            },
                            {
                              "value": 35.016327,
                              "description": "avgdl, average length of field",
                              "details": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ]
  },
  "profile": {
    "shards": [
      {
        "id": "[CAA3PraQTDm1ZB8rbP5LIg][tmdb][0]",
        "inbound_network_time_in_millis": 0,
        "outbound_network_time_in_millis": 0,
        "searches": [
          {
            "query": [
              {
                "type": "DisjunctionMaxQuery",
                "description": "((title:star title:war)^10.0 | (overview:star overview:war) | (cast:star cast:war))",
                "time_in_nanos": 2301318,
                "breakdown": {
                  "set_min_competitive_score_count": 0,
                  "match_count": 781,
                  "shallow_advance_count": 0,
                  "set_min_competitive_score": 0,
                  "next_doc": 407045,
                  "match": 118914,
                  "next_doc_count": 781,
                  "score_count": 781,
                  "compute_max_score_count": 0,
                  "compute_max_score": 0,
                  "advance": 660681,
                  "advance_count": 11,
                  "score": 216685,
                  "build_scorer_count": 22,
                  "create_weight": 439443,
                  "shallow_advance": 0,
                  "create_weight_count": 1,
                  "build_scorer": 458550
                },
                "children": [
                  {
                    "type": "BoostQuery",
                    "description": "(title:star title:war)^10.0",
                    "time_in_nanos": 480514,
                    "breakdown": {
                      "set_min_competitive_score_count": 0,
                      "match_count": 80,
                      "shallow_advance_count": 27,
                      "set_min_competitive_score": 0,
                      "next_doc": 0,
                      "match": 3232,
                      "next_doc_count": 0,
                      "score_count": 80,
                      "compute_max_score_count": 32,
                      "compute_max_score": 7563,
                      "advance": 89158,
                      "advance_count": 89,
                      "score": 19807,
                      "build_scorer_count": 20,
                      "create_weight": 183482,
                      "shallow_advance": 7640,
                      "create_weight_count": 1,
                      "build_scorer": 169632
                    },
                    "children": [
                      {
                        "type": "TermQuery",
                        "description": "title:star",
                        "time_in_nanos": 194859,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 54,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 44,
                          "compute_max_score_count": 59,
                          "compute_max_score": 3872,
                          "advance": 4632,
                          "advance_count": 53,
                          "score": 5926,
                          "build_scorer_count": 29,
                          "create_weight": 129756,
                          "shallow_advance": 2250,
                          "create_weight_count": 1,
                          "build_scorer": 48423
                        }
                      },
                      {
                        "type": "TermQuery",
                        "description": "title:war",
                        "time_in_nanos": 99654,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 54,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 46,
                          "compute_max_score_count": 59,
                          "compute_max_score": 3366,
                          "advance": 8188,
                          "advance_count": 55,
                          "score": 6863,
                          "build_scorer_count": 29,
                          "create_weight": 50308,
                          "shallow_advance": 2157,
                          "create_weight_count": 1,
                          "build_scorer": 28772
                        }
                      }
                    ]
                  },
                  {
                    "type": "BooleanQuery",
                    "description": "overview:star overview:war",
                    "time_in_nanos": 1655883,
                    "breakdown": {
                      "set_min_competitive_score_count": 0,
                      "match_count": 721,
                      "shallow_advance_count": 27,
                      "set_min_competitive_score": 0,
                      "next_doc": 2331,
                      "match": 30133,
                      "next_doc_count": 5,
                      "score_count": 721,
                      "compute_max_score_count": 37,
                      "compute_max_score": 9369,
                      "advance": 1159074,
                      "advance_count": 727,
                      "score": 138679,
                      "build_scorer_count": 22,
                      "create_weight": 122722,
                      "shallow_advance": 6896,
                      "create_weight_count": 1,
                      "build_scorer": 186679
                    },
                    "children": [
                      {
                        "type": "TermQuery",
                        "description": "overview:star",
                        "time_in_nanos": 182209,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 61,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 286,
                          "compute_max_score_count": 71,
                          "compute_max_score": 5595,
                          "advance": 27999,
                          "advance_count": 297,
                          "score": 28021,
                          "build_scorer_count": 33,
                          "create_weight": 69948,
                          "shallow_advance": 3618,
                          "create_weight_count": 1,
                          "build_scorer": 47028
                        }
                      },
                      {
                        "type": "TermQuery",
                        "description": "overview:war",
                        "time_in_nanos": 713071,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 61,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 451,
                          "compute_max_score_count": 71,
                          "compute_max_score": 15290,
                          "advance": 544149,
                          "advance_count": 462,
                          "score": 54155,
                          "build_scorer_count": 33,
                          "create_weight": 51692,
                          "shallow_advance": 10476,
                          "create_weight_count": 1,
                          "build_scorer": 37309
                        }
                      }
                    ]
                  },
                  {
                    "type": "BooleanQuery",
                    "description": "cast:star cast:war",
                    "time_in_nanos": 177206,
                    "breakdown": {
                      "set_min_competitive_score_count": 0,
                      "match_count": 0,
                      "shallow_advance_count": 15,
                      "set_min_competitive_score": 0,
                      "next_doc": 0,
                      "match": 0,
                      "next_doc_count": 0,
                      "score_count": 6,
                      "compute_max_score_count": 25,
                      "compute_max_score": 5000,
                      "advance": 3030,
                      "advance_count": 11,
                      "score": 3467,
                      "build_scorer_count": 16,
                      "create_weight": 128619,
                      "shallow_advance": 2940,
                      "create_weight_count": 1,
                      "build_scorer": 34150
                    },
                    "children": [
                      {
                        "type": "TermQuery",
                        "description": "cast:star",
                        "time_in_nanos": 81795,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 15,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 6,
                          "compute_max_score_count": 25,
                          "compute_max_score": 1958,
                          "advance": 2054,
                          "advance_count": 11,
                          "score": 2608,
                          "build_scorer_count": 21,
                          "create_weight": 60760,
                          "shallow_advance": 924,
                          "create_weight_count": 1,
                          "build_scorer": 13491
                        }
                      },
                      {
                        "type": "TermQuery",
                        "description": "cast:war",
                        "time_in_nanos": 67631,
                        "breakdown": {
                          "set_min_competitive_score_count": 0,
                          "match_count": 0,
                          "shallow_advance_count": 0,
                          "set_min_competitive_score": 0,
                          "next_doc": 0,
                          "match": 0,
                          "next_doc_count": 0,
                          "score_count": 0,
                          "compute_max_score_count": 0,
                          "compute_max_score": 0,
                          "advance": 0,
                          "advance_count": 0,
                          "score": 0,
                          "build_scorer_count": 11,
                          "create_weight": 66791,
                          "shallow_advance": 0,
                          "create_weight_count": 1,
                          "build_scorer": 840
                        }
                      }
                    ]
                  }
                ]
              }
            ],
            "rewrite_time": 19882,
            "collector": [
              {
                "name": "SimpleTopScoreDocCollector",
                "reason": "search_top_hits",
                "time_in_nanos": 264785
              }
            ]
          }
        ],
        "aggregations": []
      }
    ]
  }
}
```


### Using Templates?

Then you need to change the URL to `/tmdb/_search/template`, and then we send the ID of the template to use back.

## Find and Rate Missing Documents

This Modal UI in Quepid  has two query patterns for interacting with OpenSearch.   The first is the ability for you to craft basic Lucene queries to go find some documents that then can be rated.  The second query pattern is to return ALL the documents that have been rated for a query, and is in the style of a lookup via list of id's for the documents.

### Find Documents
Not sure...  anything special here?  

### List All Documents That Have Been Rated
Not sure ...

## Show Only Rated Documents

Request

```
POST https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search

{
  "query": {
    "bool": {
      "should": {
        "multi_match": {
          "query": "star wars",
          "type": "best_fields",
          "fields": [
            "title^10",
            "overview",
            "cast"
          ]
        }
      },
      "filter": {
        "terms": {
          "_id": [
            "11",
            "12180",
            "26748",
            "29963",
            "370071"
          ]
        }
      }
    }
  },
  "explain": true,
  "profile": true,
  "_source": [
    "_id",
    "title",
    "poster_path",
    "overview",
    "cast"
  ],
  "highlight": {
    "fields": {
      "title": {},
      "poster_path": {},
      "overview": {},
      "cast": {}
    }
  },
  "from": 0,
  "size": 10
}

```

Quepid builds the filter from the list of documents that have been rated.

## Snapshot Comparison

Ummm?

## View Document

From the detailed document modal view, you can view the document in OpenSearch in a new browser window.  

```
https://quepid-opensearch.dev.o19s.com:9000/tmdb/_doc/11
````

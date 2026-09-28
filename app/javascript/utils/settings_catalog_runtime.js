const clone = (value) => JSON.parse(JSON.stringify(value))

const defaultSettings = {
  solr: {
    queryParams: "q=#$query##\n&tie=1.0",
    escapeQuery: true,
    customHeaders: "",
    headerType: "None",
    apiMethod: "JSONP",
    fieldSpec: "id:id",
    idField: "id",
    titleField: "",
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "solr",
    insecureSearchUrl: "http://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
    secureSearchUrl: "https://quepid-solr.dev.o19s.com:8985/solr/tmdb/select",
    urlFormat: "http(s?)://yourdomain.com:8983/<index>/select",
    proxyRequests: false,
    basicAuthCredential: "",
    supportsBasicAuth: true
  },
  es: {
    queryParams:
      '{\n  "query": {\n    "multi_match": {\n      "query": "#$query##",\n      "type": "best_fields",\n      "fields": ["REPLACE_ME"]\n    }\n  }\n}',
    escapeQuery: true,
    apiMethod: "POST",
    customHeaders: "",
    headerType: "None",
    fieldSpec: "id:_id",
    idField: "_id",
    titleField: "",
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "es",
    searchUrl: "http://quepid-elasticsearch.dev.o19s.com:9206/tmdb/_search",
    urlFormat: "http(s?)://yourdomain.com:9200/<index>/_search",
    proxyRequests: false,
    basicAuthCredential: "",
    supportsBasicAuth: true
  },
  os: {
    queryParams:
      '{\n  "query": {\n    "multi_match": {\n      "query": "#$query##",\n      "fields": ["*"]\n    }\n  }\n}',
    escapeQuery: true,
    apiMethod: "POST",
    customHeaders: "",
    headerType: "None",
    fieldSpec: "id:_id",
    idField: "_id",
    titleField: "",
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "os",
    searchUrl: "https://quepid-opensearch.dev.o19s.com:9000/tmdb/_search",
    urlFormat: "http(s?)://yourdomain.com:9200/<index>/_search",
    proxyRequests: false,
    basicAuthCredential: "reader:reader",
    supportsBasicAuth: true
  },
  vectara: {
    queryParams:
      '{\n  "query": [{\n    "query": "#$query##",\n    "start": 0,\n    "numResults": 10,\n    "corpusKey": [{\n      "corpusId": 1,\n      "lexicalInterpolationConfig": { "lambda": 0.025 },\n      "dim": []\n    }]\n  }]\n}',
    escapeQuery: true,
    apiMethod: "POST",
    headerType: "Custom",
    customHeaders: '{\n  "customer-id": "YOUR_CUSTOMER_ID",\n  "x-api-key": "YOUR_API_KEY"\n}',
    fieldSpec: "id:id",
    idField: "id",
    titleField: "title",
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "vectara",
    searchUrl: "https://api.vectara.io/v1/query",
    urlFormat: "https://api.vectara.io/v1/query",
    proxyRequests: false,
    basicAuthCredential: "",
    supportsBasicAuth: false
  },
  algolia: {
    queryParams:
      '{\n  "query": "#$query##",\n  "clickAnalytics": true,\n  "getRankingInfo": true,\n  "restrictSearchableAttributes": [],\n  "enableReRanking": true,\n  "attributesToHighlight": [],\n  "page": 0,\n  "hitsPerPage": 10\n}',
    escapeQuery: true,
    apiMethod: "POST",
    headerType: "Custom",
    customHeaders:
      '{\n  "x-algolia-application-id": "OKF83BFQS4",\n  "x-algolia-api-key": "eb78e83af76a1d9a0dd2a5be4f635296"\n}',
    idField: "objectID",
    titleField: "title",
    additionalFields: ["overview", "cast", "thumb:poster_path"],
    numberOfRows: 10,
    searchEngine: "algolia",
    searchUrl: "https://OKF83BFQS4-dsn.algolia.net/1/indexes/movies_demo_quepid/query",
    urlFormat: "https://<APPLICATION-ID>-dsn.algolia.net/1/indexes/<index>/query",
    proxyRequests: true,
    basicAuthCredential: "",
    supportsBasicAuth: false
  },
  static: {
    queryParams: "q=#$query##",
    escapeQuery: true,
    headerType: "None",
    apiMethod: "GET",
    customHeaders: "",
    fieldSpec: "id:id",
    idField: "id",
    titleField: "",
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "static",
    proxyRequests: false,
    supportsBasicAuth: false
  },
  searchapi: {
    escapeQuery: true,
    apiMethod: "POST",
    headerType: "None",
    customHeaders: "",
    fieldSpec: null,
    idField: null,
    titleField: null,
    additionalFields: [],
    numberOfRows: 10,
    searchEngine: "searchapi",
    searchUrl: "https://example.com/api/search",
    urlFormat: null,
    proxyRequests: true,
    supportsBasicAuth: true,
    mapperCode:
      "numberOfResultsMapper = function(data){ return data.length; };\n\ndocsMapper = function(data){\n  let docs = [];\n  for (let doc of data) { docs.push({ id: doc.publication_id, title: doc.title }); }\n  return docs;\n};"
  }
}

const tmdbSettings = {
  solr: {
    ...defaultSettings.solr,
    queryParams:
      "q=#$query##\n&defType=edismax\n&qf=text_all\n&pf=title\n&tie=1.0\n&bf=vote_average",
    fieldSpec: "id:id, title:title",
    idField: "id",
    titleField: "title",
    additionalFields: ["overview", "cast", "thumb:poster_path"]
  },
  es: {
    ...defaultSettings.es,
    queryParams:
      '{\n  "query": {\n    "multi_match": {\n      "query": "#$query##",\n      "type": "best_fields",\n      "fields": ["title^10", "overview", "cast"]\n    }\n  }\n}',
    fieldSpec: "id:_id, title:title",
    titleField: "title",
    additionalFields: ["overview", "cast", "thumb:poster_path"]
  },
  os: {
    ...defaultSettings.os,
    queryParams:
      '{\n  "query": {\n    "multi_match": {\n      "query": "#$query##",\n      "type": "best_fields",\n      "fields": ["title^10", "overview", "cast"]\n    }\n  }\n}',
    fieldSpec: "id:_id, title:title",
    titleField: "title",
    additionalFields: ["overview", "cast", "thumb:poster_path"]
  }
}

const troubleshootingPages = {
  solr: "Troubleshooting-Solr-and-Quepid",
  es: "Troubleshooting-Elasticsearch-and-Quepid",
  os: "Troubleshooting-OpenSearch-and-Quepid",
  vectara: "Troubleshooting-Vectara-and-Quepid",
  searchapi: "Troubleshooting-SearchAPI-and-Quepid",
  vespa: "Troubleshooting-Vespa-and-Quepid"
}

export function createSettingsCatalog() {
  let currentDefaults = clone(defaultSettings)

  return {
    defaultSettings: () => currentDefaults,
    registerMapper: (engine) => {
      currentDefaults[engine.id] = engine
    },
    supportsLookupById: (searchEngine) => !["vectara", "searchapi"].includes(searchEngine),
    supportsEscapeQuery: (searchEngine) => ["solr", "es", "os"].includes(searchEngine),
    troubleshootingWikiUrl: (searchEngine, mapperBasedSearchEngineId) => {
      const page =
        troubleshootingPages[mapperBasedSearchEngineId] || troubleshootingPages[searchEngine]
      return page ? `https://github.com/o19s/quepid/wiki/${page}` : null
    },
    demoSettingsChosen: (searchEngine, newUrl) => {
      const settings = tmdbSettings[searchEngine]
      if (!settings) return false
      if (searchEngine === "solr") {
        return (
          newUrl == null || [settings.insecureSearchUrl, settings.secureSearchUrl].includes(newUrl)
        )
      }
      return newUrl === settings.searchUrl
    },
    pickSettingsToUse: (searchEngine, newUrl) => {
      const settings = createSettingsCatalog()
      return settings.demoSettingsChosen(searchEngine, newUrl)
        ? clone(tmdbSettings[searchEngine])
        : clone(currentDefaults[searchEngine] || currentDefaults.searchapi)
    },
    defaultSolrQueryParams: () => currentDefaults.solr.queryParams,
    reset: () => {
      currentDefaults = clone(defaultSettings)
    }
  }
}

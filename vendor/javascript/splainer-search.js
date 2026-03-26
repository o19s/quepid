// factories/docFactory.js
function DocFactory() {
  const Doc = function(doc, opts) {
    const self = this;
    Object.keys(doc).forEach(function(k) {
      self[k] = doc[k];
    });
    self.doc = doc;
    self.opts = opts;
  };
  Doc.prototype = {};
  Doc.prototype.groupedBy = groupedBy;
  Doc.prototype.group = group;
  Doc.prototype.options = options;
  Doc.prototype.version = version;
  Doc.prototype.fieldsAttrName = fieldsAttrName;
  Doc.prototype.fieldsProperty = fieldsProperty;
  function groupedBy() {
    if (this.opts.groupedBy === void 0) {
      return null;
    } else {
      return this.opts.groupedBy;
    }
  }
  function options() {
    return this.opts;
  }
  function group() {
    if (this.opts.group === void 0) {
      return null;
    } else {
      return this.opts.group;
    }
  }
  function version() {
    if (this.opts.version === void 0) {
      return null;
    } else {
      return this.opts.version;
    }
  }
  function fieldsAttrName() {
    return "_source";
  }
  function fieldsProperty() {
    const self = this;
    return self[self.fieldsAttrName()];
  }
  return Doc;
}
var docFactory_default = DocFactory();

// services/urlUtils.js
var protocolRegex = /^https{0,1}\:/;
function fixURLProtocol(url) {
  if (!protocolRegex.test(url)) {
    url = "http://" + url;
  }
  return url;
}

// services/solrUrlSvc.js
var solrUrlSvc = {
  buildUrl: function(url, urlArgs) {
    url = fixURLProtocol(url);
    let baseUrl = url + "?";
    baseUrl += solrUrlSvc.formatSolrArgs(urlArgs);
    return baseUrl;
  },
  /* Given arguments of the form {q: ['*:*'], fq: ['title:foo', 'text:bar']}
   * turn into string suitable for URL query param q=*:*&fq=title:foo&fq=text:bar
   *
   * */
  formatSolrArgs: function(argsObj) {
    let rVal = "";
    Object.keys(argsObj).forEach(function(param) {
      const values = argsObj[param];
      if (typeof values === "string") {
        rVal += param + "=" + values + "&";
      } else {
        values.forEach(function(value) {
          rVal += param + "=" + value + "&";
        });
      }
    });
    rVal = rVal.replace(/\%(?!(2|3|4|5))/g, "%25");
    return rVal.slice(0, -1);
  },
  /* Given string of the form [?]q=*:*&fq=title:foo&fq=title:bar
   * turn into object of the form:
   * {q:['*:*'], fq:['title:foo', 'title:bar']}
   *
   * */
  parseSolrArgs: function(argsStr) {
    const splitUp = argsStr.split("?");
    if (splitUp.length === 2) {
      argsStr = splitUp[1];
    }
    const vars = argsStr.split("&");
    const rVal = {};
    vars.forEach(function(qVar) {
      const nameAndValue = qVar.split(/=(.*)/);
      if (nameAndValue.length >= 2) {
        const name = nameAndValue[0];
        const value = nameAndValue[1];
        let decodedValue = value;
        try {
          decodedValue = decodeURIComponent(value);
        } catch (URIError) {
          console.warn("Parameter " + value + " could not be URI decoded, this might be ok");
        }
        if (!rVal.hasOwnProperty(name)) {
          rVal[name] = [decodedValue];
        } else {
          rVal[name].push(decodedValue);
        }
      }
    });
    return rVal;
  },
  /* Parse a Solr URL of the form [/]solr/[collectionName]/[requestHandler]
   * return object with {collectionName: <collectionName>, requestHandler: <requestHandler>}
   * return null on failure to parse as above solr url
   * */
  parseSolrPath: function(pathStr) {
    if (pathStr.startsWith("/")) {
      pathStr = pathStr.slice(1);
    }
    const pathComponents = pathStr.split("/");
    const pcLen = pathComponents.length;
    if (pcLen >= 2) {
      const reqHandler = pathComponents[pcLen - 1];
      const collection = pathComponents[pcLen - 2];
      return { requestHandler: reqHandler, collectionName: collection };
    }
    return null;
  },
  /* Parse a Solr URL of the form [http|https]://[host]/solr/[collectionName]/[requestHandler]?[args]
   * return null on failure to parse
   * */
  parseSolrUrl: function(solrReq) {
    solrReq = fixURLProtocol(solrReq);
    const parsedUrl = new URL(solrReq);
    parsedUrl.solrArgs = solrUrlSvc.parseSolrArgs(parsedUrl.search);
    const pathParsed = solrUrlSvc.parseSolrPath(parsedUrl.pathname);
    if (pathParsed) {
      parsedUrl.collectionName = pathParsed.collectionName;
      parsedUrl.requestHandler = pathParsed.requestHandler;
    } else {
      return null;
    }
    const solrEndpoint = function() {
      return parsedUrl.protocol + "//" + parsedUrl.host + parsedUrl.pathname;
    };
    parsedUrl.solrEndpoint = solrEndpoint;
    return parsedUrl;
  },
  /*optionally escape user query text, ie
   * q=punctuation:: clearly can't search for the
   * term ":" (colon) because colon has meaning in the query syntax
   * so instead, you've got to search for
   * q=punctuation:\:
   * */
  escapeUserQuery: function(queryText) {
    const escapeChars = [
      "+",
      "-",
      "&",
      "!",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      "^",
      '"',
      "~",
      "*",
      "?",
      ":",
      "\\"
    ];
    const regexp = new RegExp("(\\" + escapeChars.join("|\\") + ")", "g");
    const symsRepl = queryText.replace(regexp, "\\$1");
    const regexpAnd = new RegExp("(^|\\s+)(and)($|\\s+)", "g");
    const andRepl = symsRepl.replace(regexpAnd, "$1\\\\$2$3");
    const regexOr = new RegExp("(^|\\s+)(or)($|\\s+)", "g");
    const orRepl = andRepl.replace(regexOr, "$1\\\\$2$3");
    return orRepl;
  },
  /* This method is a bit tied to how the searchSvc behaves, but
   * as this module is probably what you're using to chop up a user's SolrURL
   * its placed here
   *
   * It strips arguments out that are not supported by searchSvc and
   * generally interfere with its operation (ie fl, facet, etc). searchSvc
   * removes these itself, but this is placed here for convenience to remove
   * from user input (ie an fl may confuse the user when fl is actually supplied
   * elsewhere)
   * */
  removeUnsupported: function(solrArgs) {
    const warnings = {};
    delete solrArgs["json.wrf"];
    delete solrArgs.facet;
    delete solrArgs["facet.field"];
    delete solrArgs.fl;
    delete solrArgs.hl;
    delete solrArgs["hl.simple.pre"];
    delete solrArgs["hl.simple.post"];
    delete solrArgs.wt;
    delete solrArgs.debug;
    return warnings;
  }
};

// services/htmlUtils.js
var entityMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;"
};
var escapeHtml = function(string) {
  return String(string).replace(/[&<>"'\/]/g, function(s) {
    return entityMap[s];
  });
};

// factories/solrDocFactory.js
function SolrDocFactory() {
  const Doc = function(doc, options) {
    docFactory_default.call(this, doc, options);
  };
  Doc.prototype = Object.create(docFactory_default.prototype);
  Doc.prototype.constructor = Doc;
  Doc.prototype._url = _url;
  Doc.prototype.explain = explain2;
  Doc.prototype.snippet = snippet;
  Doc.prototype.origin = origin;
  Doc.prototype.highlight = highlight;
  const buildDocUrl2 = function(fieldList, url, idField, docId) {
    const escId = encodeURIComponent(docId);
    const urlArgs = {
      indent: ["true"],
      wt: ["json"]
    };
    return solrUrlSvc.buildUrl(url, urlArgs) + "&q=" + idField + ":" + escId;
  };
  function _url(idField, docId) {
    const self = this;
    return buildDocUrl2(self.options().fieldList, self.options().url, idField, docId);
  }
  function explain2(docId) {
    const self = this;
    if (self.options().explDict.hasOwnProperty(docId)) {
      return self.options().explDict[docId];
    } else {
      return null;
    }
  }
  function snippet(docId, fieldName) {
    const self = this;
    if (self.options().hlDict.hasOwnProperty(docId)) {
      const docHls = self.options().hlDict[docId];
      if (docHls.hasOwnProperty(fieldName)) {
        return docHls[fieldName];
      }
    }
    return null;
  }
  function origin() {
    const self = this;
    return structuredClone(self.doc);
  }
  function highlight(docId, fieldName, preText, postText) {
    const self = this;
    const fieldValue = self.snippet(docId, fieldName);
    if (fieldValue && fieldValue instanceof Array) {
      if (fieldValue.length === 0) {
        return null;
      }
      const escapedValues = [];
      fieldValue.forEach(function(value) {
        const esc = escapeHtml(value);
        const preRegex = new RegExp(self.options().highlightingPre, "g");
        const hlPre = esc.replace(preRegex, preText);
        const postRegex = new RegExp(self.options().highlightingPost, "g");
        const hlPost = hlPre.replace(postRegex, postText);
        escapedValues.push(hlPost);
      });
      return escapedValues;
    } else if (fieldValue) {
      const esc = escapeHtml(fieldValue);
      const preRegex = new RegExp(self.options().highlightingPre, "g");
      const hlPre = esc.replace(preRegex, preText);
      const postRegex = new RegExp(self.options().highlightingPost, "g");
      const hlPost = hlPre.replace(postRegex, postText);
      return hlPost;
    } else {
      return null;
    }
  }
  return Doc;
}
var solrDocFactory_default = SolrDocFactory();

// factories/searcherFactory.js
var SearcherFactory = function(options, preprocessor) {
  const self = this;
  self.fieldList = options.fieldList;
  self.hlFieldList = options.hlFieldList;
  self.url = options.url;
  self.args = options.args;
  self.queryText = options.queryText;
  self.config = options.config;
  self.type = options.type;
  self.customHeaders = options.customHeaders;
  self.docs = [];
  self.grouped = {};
  self.numFound = 0;
  self.inError = false;
  self.othersExplained = {};
  self.parsedQueryDetails = {};
  self.HIGHLIGHTING_PRE = options.HIGHLIGHTING_PRE;
  self.HIGHLIGHTING_POST = options.HIGHLIGHTING_POST;
  preprocessor.prepare(self);
};
SearcherFactory.prototype.addDocToGroup = function(groupedBy, group, doc) {
  const self = this;
  if (!self.grouped.hasOwnProperty(groupedBy)) {
    self.grouped[groupedBy] = [];
  }
  let found = null;
  self.grouped[groupedBy].forEach(function(groupedDocs) {
    if (groupedDocs.value === group && !found) {
      found = groupedDocs;
    }
  });
  if (!found) {
    found = { docs: [], value: group };
    self.grouped[groupedBy].push(found);
  }
  found.docs.push(doc);
};
var searcherFactory_default = SearcherFactory;

// factories/transportFactory.js
var TransportFactory = function(opts) {
  const self = this;
  self.options = options;
  function options() {
    return opts;
  }
};
var transportFactory_default = TransportFactory;

// factories/httpTransportFactory.js
var HttpTransportFactory = function(options) {
  const method = options.method || "POST";
  const proxyUrl = options.proxyUrl;
  const userOpts = Object.assign({}, options);
  delete userOpts.method;
  delete userOpts.proxyUrl;
  transportFactory_default.call(this, userOpts);
  this._method = method;
  this._proxyUrl = proxyUrl;
};
HttpTransportFactory.prototype = Object.create(transportFactory_default.prototype);
HttpTransportFactory.prototype.constructor = HttpTransportFactory;
HttpTransportFactory.prototype.query = function query(url, payload, headers) {
  if (this._proxyUrl) {
    url = this._proxyUrl + url;
  }
  const fetchOptions = { method: this._method, headers };
  if (this._method === "POST") {
    fetchOptions.body = typeof payload === "object" && payload !== null ? JSON.stringify(payload) : payload;
    const mergedHeaders = Object.assign({}, headers);
    if (typeof payload === "object" && payload !== null) {
      mergedHeaders["Content-Type"] = mergedHeaders["Content-Type"] || "application/json";
    }
    fetchOptions.headers = mergedHeaders;
  }
  return fetch(url, fetchOptions).then(function(resp) {
    const status = resp.status;
    return resp.json().then(
      function(data) {
        if (!resp.ok) {
          return Promise.reject({ data, status, statusText: resp.statusText });
        }
        return { data, status };
      },
      function() {
        return Promise.reject({ data: null, status, statusText: resp.statusText });
      }
    );
  }).catch(function(err) {
    if (err && err.status !== void 0) {
      return Promise.reject(err);
    }
    return Promise.reject({ data: null, status: 0, statusText: err.message || "Network Error" });
  });
};
var httpTransportFactory_default = HttpTransportFactory;

// factories/httpJsonpTransportFactory.js
var HttpJsonpTransportFactory = function(options) {
  transportFactory_default.call(this, options);
};
HttpJsonpTransportFactory.prototype = Object.create(transportFactory_default.prototype);
HttpJsonpTransportFactory.prototype.constructor = HttpJsonpTransportFactory;
var jsonpCounter = 0;
HttpJsonpTransportFactory.prototype.query = function query2(url, payload, headers) {
  if (headers && headers["Authorization"]) {
    let userPassword = headers["Authorization"];
    userPassword = userPassword.replace("Basic ", "");
    userPassword = atob(userPassword);
    userPassword = userPassword.split(":");
    userPassword = userPassword[0] + ":" + encodeURIComponent(userPassword[1]);
    url = url.replace("://", "://" + userPassword + "@");
  }
  if (typeof document !== "undefined") {
    return new Promise(function(resolve, reject) {
      const callbackName = "_splainerJsonpCallback_" + jsonpCounter++;
      const separator = url.indexOf("?") === -1 ? "?" : "&";
      const scriptUrl = url + separator + "json.wrf=" + callbackName;
      window[callbackName] = function(data) {
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        resolve({ data, status: 200 });
      };
      const script = document.createElement("script");
      script.src = scriptUrl;
      script.onerror = function() {
        delete window[callbackName];
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
        reject({ data: null, status: 0, statusText: "JSONP request failed" });
      };
      document.body.appendChild(script);
    });
  } else {
    return fetch(url).then(function(resp) {
      const status = resp.status;
      return resp.json().then(
        function(data) {
          if (!resp.ok) {
            return Promise.reject({ data, status, statusText: resp.statusText });
          }
          return { data, status };
        },
        function() {
          return Promise.reject({ data: null, status, statusText: resp.statusText });
        }
      );
    }).catch(function(err) {
      if (err && err.status !== void 0) {
        return Promise.reject(err);
      }
      return Promise.reject({
        data: null,
        status: 0,
        statusText: err.message || "Network Error"
      });
    });
  }
};
var httpJsonpTransportFactory_default = HttpJsonpTransportFactory;

// factories/bulkTransportFactory.js
var BulkTransportFactory = function(options) {
  transportFactory_default.call(this, options);
  this.batchSender = null;
};
BulkTransportFactory.prototype = Object.create(transportFactory_default.prototype);
BulkTransportFactory.prototype.constructor = BulkTransportFactory;
BulkTransportFactory.prototype.query = function query3(url, payload, headers) {
  const self = this;
  if (!self.batchSender) {
    self.batchSender = new BatchSender(url, headers);
  } else if (self.batchSender.url() !== url) {
    self.batchSender.dispose();
    self.batchSender = new BatchSender(url, headers);
  }
  return self.batchSender.enqueue(payload);
};
var BatchSender = function(url, headers) {
  const requestHeaders = Object.assign({ "Content-Type": "application/x-ndjson" }, headers);
  const self = this;
  self.enqueue = enqueue;
  self.url = getUrl;
  let queue = [];
  let pendingHttp = null;
  function finishBatch(batchSize) {
    pendingHttp = null;
    queue = queue.slice(batchSize);
  }
  function multiSearchSuccess(httpResp) {
    const bulkHttpResp = httpResp.data;
    if (bulkHttpResp.hasOwnProperty("responses")) {
      const respLen = bulkHttpResp.responses.length;
      dequeuePendingSearches(bulkHttpResp);
      finishBatch(respLen);
    } else {
      multiSearchFailed(bulkHttpResp);
    }
  }
  function multiSearchFailed(bulkHttpResp) {
    let numInFlight = 0;
    queue.forEach(function(pendingQuery) {
      if (pendingQuery.inFlight) {
        pendingQuery.reject(bulkHttpResp);
        numInFlight++;
      }
    });
    finishBatch(numInFlight);
  }
  function buildMultiSearch() {
    const sharedHeader = JSON.stringify({});
    const queryLines = [];
    queue.forEach(function(pendingQuery) {
      queryLines.push(sharedHeader);
      pendingQuery.inFlight = true;
      queryLines.push(JSON.stringify(pendingQuery.payload));
    });
    const data = queryLines.join("\n") + "\n";
    return data;
  }
  function dequeuePendingSearches(bulkHttpResp) {
    let queueIdx = 0;
    bulkHttpResp.responses.forEach(function(resp) {
      const currRequest = queue[queueIdx];
      if (resp.hasOwnProperty("error")) {
        currRequest.reject(resp);
      } else {
        currRequest.resolve({ data: resp });
      }
      queueIdx++;
    });
  }
  function sendMultiSearch() {
    if (!pendingHttp && queue.length > 0) {
      const payload = buildMultiSearch();
      const body = typeof payload === "object" && payload !== null ? JSON.stringify(payload) : payload;
      pendingHttp = fetch(url, { method: "POST", headers: requestHeaders, body }).then(
        function(resp) {
          const status = resp.status;
          return resp.json().then(
            function(data) {
              if (!resp.ok) {
                return Promise.reject({
                  data,
                  status,
                  statusText: resp.statusText
                });
              }
              return { data, status };
            },
            function() {
              return Promise.reject({
                data: null,
                status,
                statusText: resp.statusText || "JSON parse error"
              });
            }
          );
        }
      );
      pendingHttp.then(multiSearchSuccess, multiSearchFailed).catch(function() {
        console.debug("Failed to do multi search");
      });
    }
  }
  function enqueue(query4) {
    return new Promise(function(resolve, reject) {
      const pendingQuery = {
        resolve,
        reject,
        inFlight: false,
        payload: query4
      };
      queue.push(pendingQuery);
      if (timerId === null) {
        timerId = setTimeout(timerTick, 100);
      }
    });
  }
  let timerId = null;
  function timerTick() {
    sendMultiSearch();
    if (queue.length > 0) {
      timerId = setTimeout(timerTick, 100);
    } else {
      timerId = null;
    }
  }
  function getUrl() {
    return url;
  }
  self.dispose = function() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
  timerId = setTimeout(timerTick, 100);
};
var bulkTransportFactory_default = BulkTransportFactory;

// services/transportSvc.js
var bulkTransport = new bulkTransportFactory_default({});
var httpPostTransport = new httpTransportFactory_default({ method: "POST" });
var httpGetTransport = new httpTransportFactory_default({ method: "GET" });
var httpJsonpTransport = new httpJsonpTransportFactory_default({});
function getTransport(options) {
  let apiMethod = options.apiMethod;
  if (apiMethod !== void 0) {
    apiMethod = apiMethod.toUpperCase();
  }
  let transport = null;
  if (apiMethod === "BULK") {
    transport = bulkTransport;
  } else if (apiMethod === "JSONP") {
    transport = httpJsonpTransport;
  } else if (apiMethod === "GET") {
    transport = httpGetTransport;
  } else {
    transport = httpPostTransport;
  }
  const proxyUrl = options.proxyUrl;
  if (proxyUrl !== void 0) {
    if (transport instanceof httpJsonpTransportFactory_default) {
      throw new Error("It does not make sense to proxy a JSONP connection, use GET instead.");
    }
    if (transport instanceof bulkTransportFactory_default) {
      const inner = transport;
      transport = {
        query: function(url, payload, headers) {
          return inner.query(proxyUrl + url, payload, headers);
        }
      };
    } else {
      transport = new httpTransportFactory_default({
        method: transport._method,
        proxyUrl
      });
    }
  }
  return transport;
}
var transportSvc = { getTransport };

// values/activeQueries.js
var count = 0;
function increment() {
  count++;
}
function decrement() {
  count--;
}
function reset() {
  count = 0;
}
var activeQueries = Object.freeze({
  get count() {
    return count;
  },
  increment,
  decrement,
  reset
});

// values/defaultSolrConfig.js
var defaultSolrConfig = {
  sanitize: true,
  highlight: true,
  debug: true,
  numberOfRows: 10,
  escapeQuery: true,
  apiMethod: "JSONP"
};

// services/queryTemplateSvc.js
var defaultConfig = {
  encodeURI: false,
  defaultKw: '""'
};
function encode(queryPart, config) {
  if (config.encodeURI) {
    return encodeURIComponent(queryPart);
  } else {
    return queryPart;
  }
}
function getDescendantProp(obj, desc) {
  const arr = desc.split(".").map((s) => s.trim()).filter((s) => s.length > 0);
  while (arr.length && obj !== null) {
    let key = arr.shift();
    let defaultValue = null;
    if (key.indexOf("|") !== -1) {
      [key, defaultValue] = key.split("|");
    } else if (/keyword\d+/g.test(key)) {
      defaultValue = "";
    }
    if (Object.keys(obj).indexOf(key) > -1) {
      obj = obj[key];
    } else {
      obj = defaultValue;
    }
  }
  return obj;
}
function extractReplacements(s, parameters) {
  const extractionRegex = /#\$([\w.|]+)##/g;
  const replacements = [];
  let match;
  do {
    match = extractionRegex.exec(s);
    if (match !== null) {
      const matchedString = match[0];
      const prop = match[1];
      const replacement = getDescendantProp(parameters, prop);
      if (replacement !== null) {
        replacements.push([matchedString, replacement]);
      } else {
        console.log(`No replacement found in options for ${matchedString}`);
      }
    }
  } while (match !== null);
  return replacements;
}
function replaceInString(s, optionValues) {
  const singleTemplateMatchRegex = /^#\$[\w.|]+##$/g;
  const replacements = extractReplacements(s, optionValues);
  if (singleTemplateMatchRegex.test(s)) {
    return replacements.length > 0 ? replacements[0][1] : s;
  } else {
    let replaced = s;
    replacements.forEach((replacement) => {
      replaced = replaced.replaceAll(replacement[0], replacement[1]);
    });
    return replaced;
  }
}
var isObject = (a) => typeof a === "object" && a !== null;
var isString = (a) => typeof a === "string";
function applyTemplating(o, parameters) {
  if (isString(o)) {
    return replaceInString(o, parameters);
  } else if (Array.isArray(o)) {
    return o.map((entry) => applyTemplating(entry, parameters));
  } else if (isObject(o)) {
    const obj = Object.assign({}, o);
    for (const key of Object.keys(obj)) {
      obj[key] = applyTemplating(obj[key], parameters);
    }
    return obj;
  } else {
    return o;
  }
}
function hydrate(template, queryText, config) {
  if (!config) {
    config = defaultConfig;
  }
  if (queryText === null || queryText === void 0) {
    return template;
  }
  const parameters = /* @__PURE__ */ Object.create(null);
  parameters.query = encode(queryText, config);
  const keywords = queryText.split(/[ ,]+/).map((term) => encode(term.trim(), config));
  parameters.keyword = keywords;
  keywords.forEach((keyword, idx) => parameters[`keyword${idx + 1}`] = keyword);
  if (config.qOption) {
    parameters.qOption = config.qOption;
  }
  return applyTemplating(template, parameters);
}
function replaceQuery(qOption, args, queryText) {
  if (queryText instanceof Object) {
    return queryText;
  }
  if (queryText) {
    queryText = queryText.replace(/\\/g, "\\\\");
    queryText = queryText.replace(/"/g, '\\"');
  }
  return hydrate(args, queryText, {
    qOption,
    encodeURI: false,
    defaultKw: '\\"\\"'
  });
}
var queryTemplateSvc = {
  hydrate,
  replaceQuery
};

// services/solrSearcherPreprocessorSvc.js
var withoutUnsupported = function(argsToUse, sanitize) {
  const argsRemoved = structuredClone(argsToUse);
  if (sanitize === true) {
    solrUrlSvc.removeUnsupported(argsRemoved);
  }
  return argsRemoved;
};
var buildCallUrl = function(searcher) {
  const fieldList = searcher.fieldList;
  const hlFieldList = searcher.hlFieldList || [];
  const url = searcher.url;
  const config = searcher.config;
  const args = withoutUnsupported(searcher.args, config.sanitize);
  let queryText = searcher.queryText;
  args.fl = fieldList === "*" ? "*" : [fieldList.join(" ")];
  args.wt = ["json"];
  if (config.debug) {
    args.debug = ["true"];
    args["debug.explain.structured"] = ["true"];
  }
  if (config.highlight && hlFieldList.length > 0) {
    args.hl = ["true"];
    args["hl.method"] = ["unified"];
    args["hl.fl"] = hlFieldList.join(" ");
    args["hl.simple.pre"] = [searcher.HIGHLIGHTING_PRE];
    args["hl.simple.post"] = [searcher.HIGHLIGHTING_POST];
  } else {
    args.hl = ["false"];
  }
  if (config.escapeQuery) {
    queryText = solrUrlSvc.escapeUserQuery(queryText);
  }
  if (!args.rows) {
    args.rows = [config.numberOfRows];
  }
  let baseUrl = solrUrlSvc.buildUrl(url, args);
  baseUrl = queryTemplateSvc.hydrate(baseUrl, queryText, {
    qOption: config.qOption,
    encodeURI: true,
    defaultKw: '""'
  });
  return baseUrl;
};
function prepare(searcher) {
  if (searcher.config === void 0) {
    searcher.config = defaultSolrConfig;
  } else {
    searcher.config = Object.assign({}, defaultSolrConfig, searcher.config);
  }
  searcher.callUrl = buildCallUrl(searcher);
  searcher.linkUrl = searcher.callUrl + "&indent=true&echoParams=all";
}
var solrSearcherPreprocessorSvc = { prepare };

// services/esUrlSvc.js
function parseUrl(url) {
  url = fixURLProtocol(url);
  const a = new URL(url);
  const qIndex = url.indexOf("?");
  const hashIndex = url.indexOf("#", qIndex === -1 ? 0 : qIndex);
  const queryEnd = hashIndex !== -1 ? hashIndex : url.length;
  const rawQuery = qIndex !== -1 ? url.substring(qIndex + 1, queryEnd) : "";
  const esUri = {
    protocol: a.protocol.replace(":", ""),
    host: a.host,
    pathname: a.pathname,
    username: a.username,
    password: a.password,
    query: rawQuery
  };
  if (esUri.pathname.endsWith("/")) {
    esUri.pathname = esUri.pathname.substring(0, esUri.pathname.length - 1);
  }
  return esUri;
}
function buildDocUrl(uri, doc, addExplain) {
  const index = doc._index;
  const type = doc._type;
  const id = doc._id;
  let url = esUrlSvc.buildBaseUrl(uri);
  url = url + "/" + index + "/";
  if (!addExplain && type) {
    url = url + type + "/";
  }
  if (addExplain) {
    url = url + "_explain";
  } else if (type !== "_doc") {
    url = url + "_doc";
  }
  if (!url.endsWith("/")) {
    url += "/";
  }
  url = url + id.replace(/#/g, "%23");
  if (!addExplain) {
    url = url + "?pretty=true";
  }
  return url;
}
function buildExplainUrl(uri, doc) {
  return buildDocUrl(uri, doc, true);
}
function buildRenderTemplateUrl(uri) {
  let url = esUrlSvc.buildBaseUrl(uri);
  url = url + "/_render/template";
  return url;
}
function buildUrl(uri) {
  let url = esUrlSvc.buildBaseUrl(uri);
  url = url + uri.pathname;
  if (uri.params === void 0 && uri.query === void 0) {
    return url;
  }
  const paramsAsStrings = [];
  if (uri.params !== void 0) {
    Object.keys(uri.params).forEach(function(key) {
      const value = uri.params[key];
      paramsAsStrings.push(key + "=" + value);
    });
  }
  if (uri.query !== void 0 && uri.query !== "") {
    paramsAsStrings.push(uri.query);
  }
  if (paramsAsStrings.length === 0) {
    return url;
  }
  let finalUrl = url;
  if (finalUrl.substring(finalUrl.length - 1) === "?") {
    finalUrl += paramsAsStrings.join("&");
  } else {
    finalUrl += "?" + paramsAsStrings.join("&");
  }
  return finalUrl;
}
function buildBaseUrl(uri) {
  let url = uri.protocol + "://";
  url += uri.host;
  return url;
}
function setParams(uri, params) {
  uri.params = params;
}
function getHeaders(uri, customHeaders) {
  let headers = {};
  customHeaders = customHeaders || "";
  if (customHeaders.length > 0) {
    headers = JSON.parse(customHeaders);
  } else if (uri.username !== void 0 && uri.username !== "" && uri.password !== void 0 && uri.password !== "") {
    const authorization = "Basic " + btoa(uri.username + ":" + uri.password);
    headers = { Authorization: authorization };
  }
  return headers;
}
function stripBasicAuth(url) {
  return url.replace(/(:\/\/)([^@]+)@/, "$1");
}
function isBulkCall(uri) {
  return uri.pathname.endsWith("_msearch");
}
function isTemplateCall(args) {
  if (args && args.id) {
    return true;
  } else {
    return false;
  }
}
var esUrlSvc = {
  parseUrl,
  buildDocUrl,
  buildExplainUrl,
  buildUrl,
  buildBaseUrl,
  buildRenderTemplateUrl,
  setParams,
  getHeaders,
  stripBasicAuth,
  isBulkCall,
  isTemplateCall
};

// factories/solrSearcherFactory.js
var Searcher = function(options) {
  searcherFactory_default.call(this, options, solrSearcherPreprocessorSvc);
  this.queryDetails = {};
};
Searcher.prototype = Object.create(searcherFactory_default.prototype);
Searcher.prototype.constructor = Searcher;
Searcher.prototype.pager = pager;
Searcher.prototype.search = search;
Searcher.prototype.explainOther = explainOther;
function pager() {
  const self = this;
  let start = 0;
  let rows = self.config.numberOfRows;
  const nextArgs = structuredClone(self.args);
  if (nextArgs.hasOwnProperty("rows") && nextArgs.rows !== null) {
    rows = parseInt(nextArgs.rows);
  }
  if (nextArgs.hasOwnProperty("start") && nextArgs.start !== null) {
    start = parseInt(nextArgs.start) + rows;
    if (start >= self.numFound) {
      return null;
    }
  } else {
    start = rows;
  }
  nextArgs.rows = ["" + rows];
  nextArgs.start = ["" + start];
  const pageConfig = Object.assign({}, defaultSolrConfig);
  pageConfig.sanitize = false;
  pageConfig.escapeQuery = self.config.escapeQuery;
  pageConfig.apiMethod = self.config.apiMethod;
  const options = {
    fieldList: self.fieldList,
    hlFieldList: self.hlFieldList,
    url: self.url,
    args: nextArgs,
    queryText: self.queryText,
    config: pageConfig,
    type: self.type,
    HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
    HIGHLIGHTING_POST: self.HIGHLIGHTING_POST
  };
  const nextSearcher = new Searcher(options);
  return nextSearcher;
}
function search() {
  const self = this;
  let url = self.callUrl;
  self.inError = false;
  const thisSearcher = self;
  const getExplData = function(solrResp) {
    if (solrResp.hasOwnProperty("debug") && solrResp.debug !== null) {
      const dbg = solrResp.debug;
      if (dbg.hasOwnProperty("explain") && dbg.explain !== null) {
        return dbg.explain;
      }
    }
    return {};
  };
  const getOthersExplained = function(solrResp) {
    if (solrResp.hasOwnProperty("debug") && solrResp.debug !== null) {
      const dbg = solrResp.debug;
      if (dbg.hasOwnProperty("explainOther") && dbg.explainOther !== null) {
        return dbg.explainOther;
      }
    }
  };
  const getTimingDetails = function(solrResp) {
    let queryTimingData = {};
    if (solrResp.hasOwnProperty("debug") && solrResp.debug !== null) {
      if (solrResp.debug.hasOwnProperty("timing") && solrResp.debug.timing !== null) {
        const timing = solrResp.debug.timing;
        queryTimingData = {
          name: "timing",
          duration: timing.time,
          events: []
        };
        if (timing.hasOwnProperty("prepare") && timing.prepare !== null) {
          const keys = Object.keys(timing.prepare);
          if (timing.prepare.hasOwnProperty("time")) {
            keys.splice(keys.indexOf("time"), 1);
          }
          keys.forEach(function(key) {
            const event = {
              name: "prepare_" + key,
              duration: timing.prepare[key].time
            };
            queryTimingData.events.push(event);
          });
        }
        if (timing.hasOwnProperty("process") && timing.process !== null) {
          const keys = Object.keys(timing.process);
          if (timing.process.hasOwnProperty("time")) {
            keys.splice(keys.indexOf("time"), 1);
          }
          keys.forEach(function(key) {
            const event = {
              name: "process_" + key,
              duration: timing.process[key].time
            };
            queryTimingData.events.push(event);
          });
        }
      }
    }
    return queryTimingData;
  };
  const getQueryDetails = function(solrResp) {
    let queryDetails = {};
    if (solrResp.hasOwnProperty("responseHeader") && solrResp.responseHeader !== null) {
      const responseHeader = solrResp.responseHeader;
      if (responseHeader.hasOwnProperty("params") && responseHeader.params !== null) {
        queryDetails = solrResp.responseHeader.params;
      }
    }
    return queryDetails;
  };
  const getQueryParsingData = function(solrResp) {
    const queryParsingData = {};
    if (solrResp.hasOwnProperty("debug") && solrResp.debug !== null) {
      const keysToIgnore = ["track", "timing", "explain", "explainOther"];
      const dbg = solrResp.debug;
      const keys = Object.keys(dbg);
      keysToIgnore.forEach(function(keyToIgnore) {
        if (dbg.hasOwnProperty(keyToIgnore)) {
          keys.splice(keys.indexOf(keyToIgnore), 1);
        }
      });
      keys.forEach(function(key) {
        queryParsingData[key] = dbg[key];
      });
    }
    if (solrResp.hasOwnProperty("querqy.infoLog") && solrResp["querqy.infoLog"] !== null) {
      queryParsingData["querqy.infoLog"] = solrResp["querqy.infoLog"];
    }
    if (solrResp.hasOwnProperty("querqy_decorations") && solrResp["querqy_decorations"] !== null) {
      queryParsingData["querqy_decorations"] = solrResp["querqy_decorations"];
    }
    return queryParsingData;
  };
  const getHlData = function(solrResp) {
    if (solrResp.hasOwnProperty("highlighting") && solrResp.highlighting !== null) {
      return solrResp.highlighting;
    }
    return {};
  };
  activeQueries.increment();
  let apiMethod = defaultSolrConfig.apiMethod;
  if (self.config && self.config.apiMethod) {
    apiMethod = self.config.apiMethod;
  }
  const uri = esUrlSvc.parseUrl(url);
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  url = esUrlSvc.stripBasicAuth(url);
  const proxyUrl = self.config.proxyUrl;
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  return transport.query(url, null, headers).then(
    function success(resp) {
      const solrResp = resp.data;
      activeQueries.decrement();
      const explDict = getExplData(solrResp);
      const hlDict = getHlData(solrResp);
      thisSearcher.othersExplained = getOthersExplained(solrResp);
      thisSearcher.parsedQueryDetails = getQueryParsingData(solrResp);
      thisSearcher.queryDetails = getQueryDetails(solrResp);
      thisSearcher.timingDetails = getTimingDetails(solrResp);
      const parseSolrDoc = function(solrDoc, groupedBy, group) {
        const options = {
          groupedBy,
          group,
          fieldList: self.fieldList,
          hlFieldList: self.hlFieldList,
          url: self.url,
          explDict,
          hlDict,
          highlightingPre: self.HIGHLIGHTING_PRE,
          highlightingPost: self.HIGHLIGHTING_POST
        };
        return new solrDocFactory_default(solrDoc, options);
      };
      if (solrResp.hasOwnProperty("response") && solrResp.response !== null) {
        solrResp.response.docs.forEach(function(solrDoc) {
          const doc = parseSolrDoc(solrDoc);
          thisSearcher.numFound = solrResp.response.numFound;
          thisSearcher.docs.push(doc);
        });
      } else if (solrResp.hasOwnProperty("grouped") && solrResp.grouped !== null) {
        Object.keys(solrResp.grouped).forEach(function(groupedByName) {
          const groupedBy = solrResp.grouped[groupedByName];
          thisSearcher.numFound = groupedBy.matches;
          if (groupedBy.hasOwnProperty("doclist") && groupedBy.doclist !== null) {
            groupedBy.doclist.docs.forEach(function(solrDoc) {
              const doc = parseSolrDoc(solrDoc, groupedByName, solrDoc[groupedByName]);
              thisSearcher.docs.push(doc);
              thisSearcher.addDocToGroup(groupedByName, solrDoc[groupedByName], doc);
            });
          }
          if (groupedBy.groups) {
            groupedBy.groups.forEach(function(groupResp) {
              const groupValue = groupResp.groupValue;
              groupResp.doclist.docs.forEach(function(solrDoc) {
                const doc = parseSolrDoc(solrDoc, groupedByName, groupValue);
                thisSearcher.docs.push(doc);
                thisSearcher.addDocToGroup(groupedByName, groupValue, doc);
              });
            });
          }
        });
      }
    },
    function error(msg) {
      activeQueries.decrement();
      thisSearcher.inError = true;
      msg.searchError = "Error with Solr query or server. Contact Solr directly to inspect the error";
      return Promise.reject(msg);
    }
  ).catch(function(response) {
    console.debug("Failed to run search");
    return Promise.reject(response);
  });
}
function explainOther(otherQuery, fieldSpec, defType) {
  const self = this;
  self.args.explainOther = [otherQuery];
  solrSearcherPreprocessorSvc.prepare(self);
  return self.search().then(function() {
    let start = 0;
    let rows = self.config.numberOfRows;
    if (self.args.rows !== void 0 && self.args.rows !== null) {
      rows = self.args.rows;
    }
    if (self.args.start !== void 0 && self.args.start !== null) {
      start = self.args.start;
    }
    const solrParams = {
      qf: [fieldSpec.title + " " + fieldSpec.id],
      rows: [rows],
      start: [start],
      q: [otherQuery]
    };
    if (defType) {
      solrParams.defType = defType;
    }
    const otherSearcherOptions = {
      fieldList: self.fieldList,
      hlFieldList: self.hlFieldList,
      url: self.url,
      args: solrParams,
      queryText: otherQuery,
      config: {
        numberOfRows: self.config.numberOfRows
      },
      type: self.type,
      HIGHLIGHTING_PRE: self.HIGHLIGHTING_PRE,
      HIGHLIGHTING_POST: self.HIGHLIGHTING_POST
    };
    const otherSearcher = new Searcher(otherSearcherOptions);
    return otherSearcher.search().then(function() {
      self.numFound = otherSearcher.numFound;
      self.docs = otherSearcher.docs;
    });
  }).catch(function(response) {
    console.debug("Failed to run explainOther");
    return Promise.reject(response);
  });
}
var solrSearcherFactory_default = Searcher;

// factories/esDocFactory.js
function EsDocFactory() {
  const Doc = function(doc, options) {
    docFactory_default.call(this, doc, options);
    const self = this;
    const fp = self.fieldsProperty();
    Object.keys(fp).forEach(function(fieldName) {
      const fieldValue = fp[fieldName];
      if (Array.isArray(fieldValue) && fieldValue.length === 1) {
        self[fieldName] = fieldValue[0];
      } else {
        self[fieldName] = fieldValue;
      }
    });
    delete self.highlight;
  };
  Doc.prototype = Object.create(docFactory_default.prototype);
  Doc.prototype.constructor = Doc;
  Doc.prototype._url = _url;
  Doc.prototype.fieldsProperty = fieldsProperty;
  Doc.prototype.explain = explain2;
  Doc.prototype.snippet = snippet;
  Doc.prototype.origin = origin;
  Doc.prototype.highlight = highlight;
  function _url() {
    const self = this;
    const doc = self.doc;
    const esurl = self.options().url;
    const uri = esUrlSvc.parseUrl(esurl);
    return esUrlSvc.buildDocUrl(uri, doc);
  }
  function fieldsProperty() {
    const self = this;
    return Object.assign({}, self["_source"], self["fields"]);
  }
  function explain2() {
    const self = this;
    return self.options().explDict;
  }
  function snippet(docId, fieldName) {
    const self = this;
    if (self.doc.hasOwnProperty("highlight")) {
      const docHls = self.doc.highlight;
      if (docHls.hasOwnProperty(fieldName)) {
        return docHls[fieldName];
      }
    }
    return null;
  }
  function origin() {
    const self = this;
    const src = {};
    Object.keys(self).forEach(function(field) {
      const value = self[field];
      if (typeof value !== "function") {
        src[field] = value;
      }
    });
    delete src.doc;
    delete src.fields;
    delete src._explanation;
    delete src.highlight;
    return src;
  }
  function highlight(docId, fieldName, preText, postText) {
    const self = this;
    const fieldValue = self.snippet(docId, fieldName);
    if (fieldValue) {
      const newValue = [];
      fieldValue.forEach(function(value) {
        const preRegex = new RegExp("<em>", "g");
        const hlPre = value.replace(preRegex, preText);
        const postRegex = new RegExp("</em>", "g");
        newValue.push(hlPre.replace(postRegex, postText));
      });
      return newValue;
    } else {
      return null;
    }
  }
  return Doc;
}
var esDocFactory_default = EsDocFactory();

// values/defaultESConfig.js
var defaultESConfig = {
  sanitize: true,
  highlight: true,
  debug: true,
  escapeQuery: true,
  numberOfRows: 10,
  apiMethod: "POST",
  version: "5.0"
};

// services/esSearcherPreprocessorSvc.js
var fieldsParamNames = ["_source"];
var { replaceQuery: replaceQuery2 } = queryTemplateSvc;
var prepareHighlighting = function(args, fields) {
  if (fields !== void 0 && fields !== null) {
    if (typeof fields === "object" && fields.hasOwnProperty("fields")) {
      fields = fields.fields;
    }
    if (Array.isArray(fields) && fields.length > 0) {
      const hl = { fields: {} };
      fields.forEach(function(fieldName) {
        if (fieldName === "_id") {
          return;
        }
        hl.fields[fieldName] = {};
      });
      return hl;
    }
  }
  return {
    fields: {
      _all: {}
    }
  };
};
var preparePostRequest = function(searcher) {
  const pagerArgs = searcher.args.pager ? structuredClone(searcher.args.pager) : {};
  const defaultPagerArgs = {
    from: 0,
    size: searcher.config.numberOfRows
  };
  searcher.pagerArgs = Object.assign({}, defaultPagerArgs, pagerArgs);
  delete searcher.args.pager;
  const queryDsl = replaceQuery2(searcher.config.qOption, searcher.args, searcher.queryText);
  queryDsl.explain = true;
  queryDsl.profile = true;
  if (searcher.fieldList !== void 0 && searcher.fieldList !== null) {
    fieldsParamNames.forEach(function(name) {
      queryDsl[name] = searcher.fieldList;
    });
  }
  if (!queryDsl.hasOwnProperty("highlight")) {
    queryDsl.highlight = prepareHighlighting(searcher.args, queryDsl[fieldsParamNames[0]]);
  }
  searcher.queryDsl = queryDsl;
};
var prepareGetRequest = function(searcher) {
  searcher.url = searcher.url + "?q=" + searcher.queryText;
  const pagerArgs = searcher.args.pager ? structuredClone(searcher.args.pager) : null;
  delete searcher.args.pager;
  if (pagerArgs !== null) {
    searcher.url += "&from=" + pagerArgs.from;
    searcher.url += "&size=" + pagerArgs.size;
  } else {
    searcher.url += "&size=" + searcher.config.numberOfRows;
  }
};
function prepare2(searcher) {
  if (searcher.config === void 0) {
    searcher.config = defaultESConfig;
  } else {
    searcher.config = Object.assign({}, defaultESConfig, searcher.config);
  }
  if (searcher.config.apiMethod === "POST") {
    preparePostRequest(searcher);
  } else if (searcher.config.apiMethod === "GET") {
    prepareGetRequest(searcher);
  }
}
var esSearcherPreprocessorSvc = { fieldsParamNames, prepare: prepare2 };

// factories/esSearcherFactory.js
function formatError(msg) {
  let errorMsg = "";
  if (msg) {
    if (msg.status >= 400) {
      errorMsg = "HTTP Error: " + msg.status + " " + msg.statusText;
    }
    if (msg.status > 0) {
      if (msg.hasOwnProperty("data") && msg.data) {
        if (msg.data.hasOwnProperty("error")) {
          errorMsg += "\n" + JSON.stringify(msg.data.error, null, 2);
        }
        if (msg.data.hasOwnProperty("_shards")) {
          msg.data._shards.failures.forEach(function(failure) {
            errorMsg += "\n" + JSON.stringify(failure, null, 2);
          });
        }
      }
    } else if (msg.status === -1 || msg.status === 0) {
      errorMsg += "Network Error! (host not found)\n";
      errorMsg += "\n";
      errorMsg += "or CORS needs to be configured for your Elasticsearch\n";
      errorMsg += "\n";
      errorMsg += "Enable CORS in elasticsearch.yml:\n";
      errorMsg += "\n";
      errorMsg += 'http.cors.allow-origin: "/https?:\\\\/\\\\/(.*?\\\\.)?(quepid\\\\.com|splainer\\\\.io)/"\n';
      errorMsg += "http.cors.enabled: true\n";
    }
    msg.searchError = errorMsg;
  }
  return msg;
}
var Searcher2 = function(options) {
  searcherFactory_default.call(this, options, esSearcherPreprocessorSvc);
};
Searcher2.prototype = Object.create(searcherFactory_default.prototype);
Searcher2.prototype.constructor = Searcher2;
Searcher2.prototype.pager = pager2;
Searcher2.prototype.search = search2;
Searcher2.prototype.explainOther = explainOther2;
Searcher2.prototype.explain = explain;
Searcher2.prototype.majorVersion = majorVersion;
Searcher2.prototype.isTemplateCall = isTemplateCall2;
Searcher2.prototype.renderTemplate = renderTemplate;
function pager2() {
  const self = this;
  let pagerArgs = { from: 0, size: self.config.numberOfRows };
  const nextArgs = structuredClone(self.args);
  if (nextArgs.hasOwnProperty("pager") && nextArgs.pager !== void 0) {
    pagerArgs = nextArgs.pager;
  } else if (self.hasOwnProperty("pagerArgs") && self.pagerArgs !== void 0) {
    pagerArgs = self.pagerArgs;
  }
  if (pagerArgs.hasOwnProperty("from")) {
    pagerArgs.from = parseInt(pagerArgs.from) + pagerArgs.size;
    if (pagerArgs.from >= self.numFound) {
      return null;
    }
  } else {
    pagerArgs.from = pagerArgs.size;
  }
  nextArgs.pager = pagerArgs;
  const options = {
    args: nextArgs,
    config: self.config,
    fieldList: self.fieldList,
    queryText: self.queryText,
    type: self.type,
    url: self.url
  };
  const nextSearcher = new Searcher2(options);
  return nextSearcher;
}
function search2() {
  const self = this;
  const uri = esUrlSvc.parseUrl(self.url);
  let apiMethod = self.config.apiMethod;
  const proxyUrl = self.config.proxyUrl;
  if (esUrlSvc.isBulkCall(uri)) {
    apiMethod = "BULK";
  }
  const templateCall = isTemplateCall2(self.args);
  if (templateCall) {
    uri.pathname = uri.pathname + "/template";
  }
  if (apiMethod === "GET" && !templateCall) {
    const fieldList = self.fieldList === "*" ? "*" : self.fieldList.join(",");
    esUrlSvc.setParams(uri, {
      _source: fieldList
    });
  }
  const url = esUrlSvc.buildUrl(uri);
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  const queryDslWithPagerArgs = structuredClone(self.queryDsl);
  if (self.pagerArgs) {
    if (templateCall) {
      queryDslWithPagerArgs.params.from = self.pagerArgs.from;
      queryDslWithPagerArgs.params.size = self.pagerArgs.size;
    } else {
      queryDslWithPagerArgs.from = self.pagerArgs.from;
      queryDslWithPagerArgs.size = self.pagerArgs.size;
    }
  }
  if (templateCall) {
    delete queryDslWithPagerArgs._source;
    delete queryDslWithPagerArgs.highlight;
  } else if (self.config.highlight === false) {
    delete queryDslWithPagerArgs.highlight;
  }
  self.inError = false;
  const getExplData = function(doc) {
    if (doc.hasOwnProperty("_explanation")) {
      return doc._explanation;
    } else {
      return null;
    }
  };
  const getHlData = function(doc) {
    if (doc.hasOwnProperty("highlight")) {
      return doc.highlight;
    } else {
      return null;
    }
  };
  const getQueryParsingData = function(data) {
    if (data.hasOwnProperty("profile")) {
      return data.profile;
    } else {
      return {};
    }
  };
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  activeQueries.increment();
  return transport.query(url, queryDslWithPagerArgs, headers).then(
    function success(httpConfig) {
      const data = httpConfig.data;
      activeQueries.decrement();
      if (data.hits.hasOwnProperty("total") && data.hits.total.hasOwnProperty("value")) {
        self.numFound = data.hits.total.value;
      } else {
        self.numFound = data.hits.total;
      }
      self.parsedQueryDetails = getQueryParsingData(data);
      const parseDoc = function(doc, groupedBy, group) {
        const explDict = getExplData(doc);
        const hlDict = getHlData(doc);
        const options = {
          groupedBy,
          group,
          fieldList: self.fieldList,
          url: self.url,
          explDict,
          hlDict,
          version: self.majorVersion()
        };
        return new esDocFactory_default(doc, options);
      };
      data.hits.hits.forEach(function(hit) {
        const doc = parseDoc(hit);
        self.docs.push(doc);
      });
      if (data._shards !== void 0 && data._shards.failed > 0) {
        return Promise.reject(formatError(httpConfig));
      }
    },
    function error(msg) {
      activeQueries.decrement();
      self.inError = true;
      return Promise.reject(formatError(msg));
    }
  ).catch(function(response) {
    console.debug("Failed to execute search");
    return Promise.reject(response);
  });
}
function explainOther2(otherQuery) {
  const self = this;
  const otherSearcherOptions = {
    fieldList: self.fieldList,
    url: self.url,
    args: self.args,
    queryText: otherQuery,
    config: {
      apiMethod: "POST",
      customHeaders: self.config.customHeaders,
      numberOfRows: self.config.numberOfRows,
      version: self.config.version
    },
    type: self.type
  };
  if (self.pagerArgs !== void 0 && self.pagerArgs !== null) {
    otherSearcherOptions.args.pager = self.pagerArgs;
  }
  const otherSearcher = new Searcher2(otherSearcherOptions);
  return otherSearcher.search().then(function() {
    self.numFound = otherSearcher.numFound;
    const promises = [];
    const docs = [];
    otherSearcher.docs.forEach(function(doc) {
      const promise = self.explain(doc).then(function(parsedDoc) {
        docs.push(parsedDoc);
      });
      promises.push(promise);
    });
    return Promise.all(promises).then(function() {
      self.docs = docs;
    });
  }).catch(function(response) {
    console.debug("Failed to run explainOther");
    return Promise.reject(response);
  });
}
function explain(doc) {
  const self = this;
  const uri = esUrlSvc.parseUrl(self.url);
  const url = esUrlSvc.buildExplainUrl(uri, doc);
  const proxyUrl = self.config.proxyUrl;
  const transport = transportSvc.getTransport({ apiMethod: "POST", proxyUrl });
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  return transport.query(url, { query: self.queryDsl.query }, headers).then(function(response) {
    const explDict = response.data.explanation || null;
    const options = {
      fieldList: self.fieldList,
      url: self.url,
      explDict
    };
    return new esDocFactory_default(doc, options);
  }).catch(function(response) {
    console.debug("Failed to run explain");
    return Promise.reject(response);
  });
}
function majorVersion() {
  const self = this;
  if (self.config !== void 0 && self.config.version !== void 0 && self.config.version !== null && self.config.version !== "") {
    return parseInt(self.config.version.split(".")[0]);
  } else {
    return null;
  }
}
function isTemplateCall2(args) {
  return esUrlSvc.isTemplateCall(args);
}
function renderTemplate() {
  const self = this;
  const uri = esUrlSvc.parseUrl(self.url);
  const apiMethod = self.config.apiMethod;
  const proxyUrl = self.config.proxyUrl;
  const templateCall = isTemplateCall2(self.args);
  const url = esUrlSvc.buildRenderTemplateUrl(uri);
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  const queryDslWithPagerArgs = structuredClone(self.queryDsl);
  if (self.pagerArgs) {
    if (templateCall) {
      queryDslWithPagerArgs.params.from = self.pagerArgs.from;
      queryDslWithPagerArgs.params.size = self.pagerArgs.size;
    } else {
      queryDslWithPagerArgs.from = self.pagerArgs.from;
      queryDslWithPagerArgs.size = self.pagerArgs.size;
    }
  }
  if (templateCall) {
    delete queryDslWithPagerArgs._source;
    delete queryDslWithPagerArgs.highlight;
  } else if (self.config.highlight === false) {
    delete queryDslWithPagerArgs.highlight;
  }
  self.inError = false;
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  activeQueries.increment();
  return transport.query(url, queryDslWithPagerArgs, headers).then(
    function success(httpConfig) {
      const data = httpConfig.data;
      activeQueries.decrement();
      self.renderedTemplateJson = data;
    },
    function error(msg) {
      activeQueries.decrement();
      self.inError = true;
      return Promise.reject(formatError(msg));
    }
  ).catch(function(response) {
    console.debug("Failed to render template");
    return Promise.reject(response);
  });
}
var esSearcherFactory_default = Searcher2;

// factories/vectaraDocFactory.js
function VectaraDocFactory() {
  const Doc = function(doc, options) {
    docFactory_default.call(this, doc, options);
    const self = this;
    const fp = self.fieldsProperty();
    Object.keys(fp).forEach(function(fieldName) {
      const fieldValue = fp[fieldName];
      if (Array.isArray(fieldValue) && fieldValue.length === 1) {
        self[fieldName] = fieldValue[0];
      } else {
        self[fieldName] = fieldValue;
      }
    });
  };
  Doc.prototype = Object.create(docFactory_default.prototype);
  Doc.prototype.constructor = Doc;
  Doc.prototype._url = _url;
  Doc.prototype.origin = origin;
  Doc.prototype.fieldsProperty = fieldsProperty;
  Doc.prototype.explain = explain2;
  Doc.prototype.snippet = snippet;
  Doc.prototype.highlight = highlight;
  function _url() {
    return "unavailable";
  }
  function origin() {
    const self = this;
    const src = {};
    Object.keys(self).forEach(function(field) {
      const value = self[field];
      if (typeof value !== "function") {
        src[field] = value;
      }
    });
    delete src.doc;
    delete src.metadata;
    delete src.opts;
    return src;
  }
  function fieldsProperty() {
    const self = this;
    const metadata = self.metadata;
    return metadata.reduce(function(map, obj) {
      map[obj.name] = obj.value;
      return map;
    }, {});
  }
  function explain2() {
    return {};
  }
  function snippet() {
    return null;
  }
  function highlight() {
    return null;
  }
  return Doc;
}
var vectaraDocFactory_default = VectaraDocFactory();

// values/defaultVectaraConfig.js
var defaultVectaraConfig = {
  apiMethod: "POST"
};

// services/vectaraSearcherPreprocessorSvc.js
var replaceQuery3 = function(qOption, args, queryText) {
  return queryTemplateSvc.hydrate(args, queryText, {
    qOption,
    encodeURI: false,
    defaultKw: '\\"\\"'
  });
};
var preparePostRequest2 = function(searcher) {
  const pagerArgs = searcher.args.pager ? structuredClone(searcher.args.pager) : {};
  searcher.pagerArgs = Object.assign({}, pagerArgs);
  delete searcher.args.pager;
  const queryDsl = replaceQuery3(searcher.config.qOption, searcher.args, searcher.queryText);
  searcher.queryDsl = queryDsl;
};
function prepare3(searcher) {
  if (searcher.config === void 0) {
    searcher.config = defaultVectaraConfig;
  } else {
    searcher.config = Object.assign({}, defaultVectaraConfig, searcher.config);
  }
  preparePostRequest2(searcher);
}
var vectaraSearcherPreprocessorSvc = { prepare: prepare3 };

// services/vectaraUrlSvc.js
function getHeaders2(customHeaders) {
  let headers = {};
  customHeaders = customHeaders || "";
  if (customHeaders.length > 0) {
    headers = JSON.parse(customHeaders);
  }
  return headers;
}
var vectaraUrlSvc = {
  getHeaders: getHeaders2
};

// factories/vectaraSearcherFactory.js
var Searcher3 = function(options) {
  searcherFactory_default.call(this, options, vectaraSearcherPreprocessorSvc);
};
Searcher3.prototype = Object.create(searcherFactory_default.prototype);
Searcher3.prototype.constructor = Searcher3;
Searcher3.prototype.pager = pager3;
Searcher3.prototype.search = search3;
function pager3() {
  const self = this;
  let pagerArgs = {};
  const nextArgs = structuredClone(self.args);
  if (nextArgs.hasOwnProperty("pager") && nextArgs.pager !== void 0) {
    pagerArgs = nextArgs.pager;
  } else if (self.hasOwnProperty("pagerArgs") && self.pagerArgs !== void 0) {
    pagerArgs = self.pagerArgs;
  }
  if (pagerArgs.hasOwnProperty("from")) {
    pagerArgs.from = parseInt(pagerArgs.from) + pagerArgs.size;
    if (pagerArgs.from >= self.numFound) {
      return null;
    }
  } else {
    pagerArgs.from = pagerArgs.size;
  }
  nextArgs.pager = pagerArgs;
  const options = {
    args: nextArgs,
    config: self.config,
    fieldList: self.fieldList,
    queryText: self.queryText,
    type: self.type,
    url: self.url
  };
  return new Searcher3(options);
}
function search3() {
  const self = this;
  const apiMethod = "POST";
  const proxyUrl = self.config.proxyUrl;
  const url = self.url;
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  const queryDslWithPagerArgs = structuredClone(self.queryDsl);
  if (self.pagerArgs) {
    queryDslWithPagerArgs.from = self.pagerArgs.from;
    queryDslWithPagerArgs.size = self.pagerArgs.size;
  }
  self.inError = false;
  const headers = vectaraUrlSvc.getHeaders(self.config.customHeaders);
  activeQueries.increment();
  return transport.query(url, queryDslWithPagerArgs, headers).then(
    function success(httpConfig) {
      const data = httpConfig.data;
      activeQueries.decrement();
      const documents = data.responseSet && data.responseSet.length > 0 ? data.responseSet[0].document : [];
      self.numFound = documents.length;
      const parseDoc = function(doc, groupedBy, group) {
        const options = {
          groupedBy,
          group,
          fieldList: self.fieldList,
          url: self.url
        };
        return new vectaraDocFactory_default(doc, options);
      };
      documents.forEach(function(docFromApi) {
        const doc = parseDoc(docFromApi);
        self.docs.push(doc);
      });
    },
    function error(msg) {
      activeQueries.decrement();
      self.inError = true;
      msg.searchError = "Error with Vectara query or server. Review request manually.";
      return Promise.reject(msg);
    }
  ).catch(function(response) {
    console.debug("Failed to execute search");
    return Promise.reject(response);
  });
}
var vectaraSearcherFactory_default = Searcher3;

// factories/genericDocFactory.js
function GenericDocFactory() {
  const Doc = function(doc, options) {
    docFactory_default.call(this, doc, options);
    const self = this;
    const fp = self.fieldsProperty();
    Object.keys(fp).forEach(function(fieldName) {
      const fieldValue = fp[fieldName];
      if (Array.isArray(fieldValue) && fieldValue.length === 1) {
        self[fieldName] = fieldValue[0];
      } else {
        self[fieldName] = fieldValue;
      }
    });
  };
  Doc.prototype = Object.create(docFactory_default.prototype);
  Doc.prototype.constructor = Doc;
  Doc.prototype._url = _url;
  Doc.prototype.origin = origin;
  Doc.prototype.fieldsProperty = fieldsProperty;
  Doc.prototype.explain = explain2;
  Doc.prototype.snippet = snippet;
  Doc.prototype.highlight = highlight;
  function _url() {
    return null;
  }
  function origin() {
    const self = this;
    const src = {};
    Object.keys(self).forEach(function(field) {
      const value = self[field];
      if (typeof value !== "function") {
        src[field] = value;
      }
    });
    delete src.doc;
    return src;
  }
  function fieldsProperty() {
    const self = this;
    return self;
  }
  function explain2() {
    return {};
  }
  function snippet() {
    return null;
  }
  function highlight() {
    return null;
  }
  return Doc;
}
var genericDocFactory_default = GenericDocFactory();

// services/algoliaSearcherPreprocessorSvc.js
var { replaceQuery: replaceQuery4 } = queryTemplateSvc;
var preparePostRequest3 = function(searcher) {
  const queryDsl = replaceQuery4(searcher.config.qOption, searcher.args, searcher.queryText);
  searcher.queryDsl = queryDsl;
};
function prepare4(searcher) {
  if (searcher.config.apiMethod === "POST") {
    preparePostRequest3(searcher);
  } else if (searcher.config.apiMethod === "GET") {
    throw Error("GET is not supported by Algolia");
  }
}
var algoliaSearcherPreprocessorSvc = { prepare: prepare4 };

// factories/algoliaSearchFactory.js
var Searcher4 = function(options) {
  searcherFactory_default.call(this, options, algoliaSearcherPreprocessorSvc);
};
Searcher4.prototype = Object.create(searcherFactory_default.prototype);
Searcher4.prototype.constructor = Searcher4;
Searcher4.prototype.pager = pager4;
Searcher4.prototype.search = search4;
Searcher4.prototype.getTransportParameters = getTransportParameters;
function pager4() {
  const self = this;
  let page = 0;
  const nextArgs = structuredClone(self.args);
  if (nextArgs.hasOwnProperty("page") && nextArgs.page >= 0) {
    page = nextArgs.page;
  }
  if (page !== void 0 && page >= 0) {
    page = parseInt(page) + 1;
    if (page > self.nbPages - 1) {
      return null;
    }
  } else {
    page = 0;
  }
  nextArgs.page = page;
  const options = {
    args: nextArgs,
    config: self.config,
    queryText: self.queryText,
    type: self.type,
    url: self.url
  };
  const nextSearcher = new Searcher4(options);
  return nextSearcher;
}
function getIndexName(url) {
  const pathFragments = new URL(url).pathname.split("/").filter(function(item) {
    return item.length > 0;
  });
  return pathFragments[pathFragments.length - 2];
}
function constructObjectQueryUrl(url) {
  const urlObject = new URL(url);
  urlObject.pathname = "/1/indexes/*/objects";
  return urlObject.toString();
}
function getTransportParameters(retrieveObjects) {
  const self = this;
  const uri = esUrlSvc.parseUrl(self.url);
  const url = esUrlSvc.buildUrl(uri);
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  let payload = {};
  if (retrieveObjects) {
    const indexName = getIndexName(url);
    const objectsUrl = constructObjectQueryUrl(url);
    const attributesToRetrieve = self.queryDsl && self.queryDsl.attributesToRetrieve ? self.queryDsl.attributesToRetrieve : void 0;
    payload = {
      requests: self.args.objectIds.map((id) => {
        return {
          indexName,
          objectID: id,
          attributesToRetrieve
        };
      })
    };
    return {
      url: objectsUrl,
      headers,
      payload,
      responseKey: "results"
      // Object retrieval results array is in `results`
    };
  } else {
    payload = self.queryDsl;
    return {
      url,
      headers,
      payload,
      responseKey: "hits"
      // Query results array is in `hits`
    };
  }
}
function search4() {
  const self = this;
  const apiMethod = self.config.apiMethod;
  const proxyUrl = self.config.proxyUrl;
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  const retrieveObjects = self.args.retrieveObjects;
  const transportParameters = self.getTransportParameters(retrieveObjects);
  self.inError = false;
  activeQueries.increment();
  return transport.query(transportParameters.url, transportParameters.payload, transportParameters.headers).then(
    function success(httpConfig) {
      const data = httpConfig.data;
      self.lastResponse = data;
      activeQueries.decrement();
      self.numFound = data.nbHits;
      self.nbPages = data.nbPages;
      const parseDoc = function(doc) {
        const options = {
          fieldList: self.fieldList
        };
        return new genericDocFactory_default(doc, options);
      };
      const mappedDocs = [];
      function docMapper(algoliaDoc) {
        return Object.assign({}, algoliaDoc, {
          id: algoliaDoc.objectID
        });
      }
      data[transportParameters.responseKey].forEach(function(item) {
        mappedDocs.push(docMapper(item));
      });
      mappedDocs.forEach(function(mappedDoc) {
        const doc = parseDoc(mappedDoc);
        self.docs.push(doc);
      });
    },
    function error(msg) {
      console.log("Error");
      activeQueries.decrement();
      self.inError = true;
      msg.searchError = "Error with Algolia query or API endpoint. Review request manually.";
      return Promise.reject(msg);
    }
  ).catch(function(response) {
    console.debug("Failed to execute search: " + response.type + ":" + response.message);
    return Promise.reject(response);
  });
}
var algoliaSearchFactory_default = Searcher4;

// services/searchApiSearcherPreprocessorSvc.js
var { replaceQuery: replaceQuery5 } = queryTemplateSvc;
var prepareGetRequest2 = function(searcher) {
  const queryDsl = replaceQuery5(searcher.config.qOption, searcher.args, searcher.queryText);
  const paramsAsStrings = [];
  if (typeof queryDsl === "object" && queryDsl !== null) {
    Object.keys(queryDsl).forEach(function(key) {
      const value = queryDsl[key];
      paramsAsStrings.push(key + "=" + value);
    });
  } else {
    const queryDSLAsQuerySTring = queryDsl.toString();
    paramsAsStrings.push(queryDSLAsQuerySTring);
  }
  let finalUrl = searcher.url;
  const hasQuery = finalUrl.indexOf("?") !== -1;
  const endsWithQuestion = finalUrl.substring(finalUrl.length - 1) === "?";
  let separator = "?";
  if (hasQuery) {
    separator = endsWithQuestion ? "" : "&";
  }
  finalUrl += separator + paramsAsStrings.join("&");
  searcher.url = finalUrl;
};
var preparePostRequest4 = function(searcher) {
  const queryDsl = replaceQuery5(searcher.config.qOption, searcher.args, searcher.queryText);
  searcher.queryDsl = queryDsl;
};
function prepare5(searcher) {
  if (searcher.config.apiMethod === "POST") {
    preparePostRequest4(searcher);
  } else if (searcher.config.apiMethod === "GET") {
    prepareGetRequest2(searcher);
  }
}
var searchApiSearcherPreprocessorSvc = { prepare: prepare5 };

// factories/searchApiSearcherFactory.js
var Searcher5 = function(options) {
  searcherFactory_default.call(this, options, searchApiSearcherPreprocessorSvc);
};
Searcher5.prototype = Object.create(searcherFactory_default.prototype);
Searcher5.prototype.constructor = Searcher5;
Searcher5.prototype.pager = pager5;
Searcher5.prototype.search = search5;
function pager5() {
  return null;
}
function search5() {
  const self = this;
  const apiMethod = self.config.apiMethod;
  const proxyUrl = self.config.proxyUrl;
  let url = self.url;
  const uri = esUrlSvc.parseUrl(self.url);
  const transport = transportSvc.getTransport({ apiMethod, proxyUrl });
  const payload = self.queryDsl;
  url = esUrlSvc.buildUrl(uri);
  self.inError = false;
  const headers = esUrlSvc.getHeaders(uri, self.config.customHeaders);
  activeQueries.increment();
  return transport.query(url, payload, headers).then(
    function success(httpConfig) {
      const data = httpConfig.data;
      self.lastResponse = data;
      activeQueries.decrement();
      if (self.config.numberOfResultsMapper === void 0) {
        console.warn(
          "No numberOfResultsMapper defined so can not populate the number of results found."
        );
      } else {
        try {
          self.numFound = self.config.numberOfResultsMapper(data);
        } catch (error) {
          const errMsg = "Attempting to run numberOfResultsMapper failed: " + error;
          console.error(errMsg);
          throw new Error("MapperError: " + errMsg);
        }
      }
      const parseDoc = function(doc) {
        const options = {
          fieldList: self.fieldList
        };
        return new genericDocFactory_default(doc, options);
      };
      let mappedDocs = [];
      if (self.config.docsMapper === void 0) {
        console.warn("No docsMapper defined so can not populate individual docs.");
      } else {
        try {
          mappedDocs = self.config.docsMapper(data);
        } catch (error) {
          const errMsg = "Attempting to run docsMapper failed: " + error;
          console.error(errMsg);
          throw new Error("MapperError: " + errMsg);
        }
      }
      if (self.config.numberOfRows && mappedDocs.length > self.config.numberOfRows) {
        mappedDocs = mappedDocs.slice(0, self.config.numberOfRows);
      }
      mappedDocs.forEach(function(mappedDoc) {
        const doc = parseDoc(mappedDoc);
        self.docs.push(doc);
      });
    },
    function error(msg) {
      console.log("Error");
      activeQueries.decrement();
      self.inError = true;
      msg.searchError = "Error with Search API query or server. Review request manually.";
      return Promise.reject(msg);
    }
  ).catch(function(response) {
    console.debug("Failed to execute search: " + response.type + ":" + response.message);
    return Promise.reject(response);
  });
}
var searchApiSearcherFactory_default = Searcher5;

// services/searchSvc.js
var HIGHLIGHTING_PRE = "aouaoeuCRAZY_STRING!8_______";
var HIGHLIGHTING_POST = "62362iueaiCRAZY_POST_STRING!_______";
function configFromDefault() {
  return structuredClone(defaultSolrConfig);
}
function createSearcher(fieldSpec, url, args, queryText, config, searchEngine) {
  if (searchEngine === void 0) {
    searchEngine = "solr";
  }
  const options = {
    fieldList: fieldSpec.fieldList(),
    hlFieldList: fieldSpec.highlightFieldList(),
    url,
    args,
    queryText,
    config,
    type: searchEngine
  };
  if (options.config && options.config.basicAuthCredential && options.config.basicAuthCredential.length > 0) {
    const encoded = btoa(options.config.basicAuthCredential);
    if (options.config.customHeaders && options.config.customHeaders.length > 0) {
      const head = JSON.parse(options.config.customHeaders);
      head["Authorization"] = "Basic " + encoded;
      options.config.customHeaders = JSON.stringify(head);
    } else {
      const head = { Authorization: "Basic " + encoded };
      options.config.customHeaders = JSON.stringify(head);
    }
  }
  let searcher;
  if (searchEngine === "solr") {
    options.HIGHLIGHTING_PRE = HIGHLIGHTING_PRE;
    options.HIGHLIGHTING_POST = HIGHLIGHTING_POST;
    searcher = new solrSearcherFactory_default(options);
  } else if (searchEngine === "es") {
    searcher = new esSearcherFactory_default(options);
  } else if (searchEngine === "os") {
    searcher = new esSearcherFactory_default(options);
  } else if (searchEngine === "vectara") {
    searcher = new vectaraSearcherFactory_default(options);
  } else if (searchEngine === "algolia") {
    searcher = new algoliaSearchFactory_default(options);
  } else if (searchEngine === "searchapi") {
    searcher = new searchApiSearcherFactory_default(options);
  }
  return searcher;
}
function getActiveQueries() {
  return activeQueries.count;
}
var searchSvc = {
  HIGHLIGHTING_PRE,
  HIGHLIGHTING_POST,
  configFromDefault,
  createSearcher,
  activeQueries: getActiveQueries
};

// services/fieldSpecSvc.js
var addFieldOfType = function(fieldSpec, fieldType, fieldName, fieldOptions) {
  if (["f", "func", "function"].includes(fieldType)) {
    if (!fieldSpec.hasOwnProperty("functions")) {
      fieldSpec.functions = [];
    }
    if (fieldName.startsWith("$")) {
      fieldName = fieldName.slice(1);
    }
    fieldName = fieldName + ":$" + fieldName;
    fieldSpec.functions.push(fieldName);
  }
  if (["highlight", "hl"].includes(fieldType)) {
    if (!fieldSpec.hasOwnProperty("highlights")) {
      fieldSpec.highlights = [];
    }
    fieldSpec.highlights.push(fieldName);
  }
  if (fieldType === "media") {
    if (!fieldSpec.hasOwnProperty("embeds")) {
      fieldSpec.embeds = [];
    }
    fieldSpec.embeds.push(fieldName);
  }
  if (fieldType === "translate") {
    if (!fieldSpec.hasOwnProperty("translations")) {
      fieldSpec.translations = [];
    }
    fieldSpec.translations.push(fieldName);
  }
  if (fieldType === "unabridged") {
    if (!fieldSpec.hasOwnProperty("unabridgeds")) {
      fieldSpec.unabridgeds = [];
    }
    fieldSpec.unabridgeds.push(fieldName);
  }
  if (fieldType === "sub") {
    if (!fieldSpec.hasOwnProperty("subs")) {
      fieldSpec.subs = [];
    }
    if (fieldSpec.subs !== "*") {
      fieldSpec.subs.push(fieldName);
    }
    if (fieldName === "*") {
      fieldSpec.subs = "*";
    }
  } else if (!fieldSpec.hasOwnProperty(fieldType)) {
    fieldSpec[fieldType] = fieldName;
    fieldSpec[fieldType + "_options"] = fieldOptions;
  }
  fieldSpec.fields.push(fieldName);
};
var populateFieldSpec = function(fieldSpec, fieldSpecStr) {
  const fieldSpecs = [];
  let fieldSpecStrToConsume = fieldSpecStr.split("+").join(" ");
  for (let chunkEnd = -1; fieldSpecStrToConsume.length > 0; ) {
    if (fieldSpecStrToConsume[0] === "{") {
      chunkEnd = fieldSpecStrToConsume.indexOf("}") + 1;
    } else {
      chunkEnd = fieldSpecStrToConsume.search(/[\s,]+/);
      if (chunkEnd === -1) {
        chunkEnd = fieldSpecStrToConsume.length;
      }
    }
    fieldSpecs.push(fieldSpecStrToConsume.substr(0, chunkEnd));
    fieldSpecStrToConsume = fieldSpecStrToConsume.substr(
      chunkEnd + 1,
      fieldSpecStrToConsume.length
    );
  }
  fieldSpecs.forEach(function(aField) {
    let fieldTypes = null;
    let fieldName = null;
    let fieldOptions = null;
    if (aField[0] === "{") {
      const fieldDefinition = JSON.parse(aField);
      fieldName = fieldDefinition.name;
      fieldTypes = [fieldDefinition.type];
      delete fieldDefinition.name;
      delete fieldDefinition.type;
      fieldOptions = fieldDefinition;
    } else {
      const specElements = aField.split(":");
      if (specElements.length === 1) {
        fieldName = specElements[0];
        if (fieldSpec.hasOwnProperty("title")) {
          fieldTypes = ["sub"];
        } else {
          fieldTypes = ["title"];
        }
      } else if (specElements.length > 1) {
        fieldName = specElements.pop();
        fieldTypes = specElements;
      }
    }
    if (fieldTypes && fieldName) {
      fieldTypes.forEach(function(fieldType) {
        addFieldOfType(fieldSpec, fieldType, fieldName, fieldOptions);
      });
    }
  });
};
var FieldSpec = function(fieldSpecStr) {
  this.fields = [];
  this.fieldSpecStr = fieldSpecStr;
  populateFieldSpec(this, fieldSpecStr);
  if (!this.hasOwnProperty("id")) {
    this.id = "id";
    this.fields.push("id");
  }
  if (!this.hasOwnProperty("title")) {
    this.title = this.id;
  }
  this.fieldList = function() {
    if (this.hasOwnProperty("subs") && this.subs === "*") {
      return "*";
    }
    const rVal = [this.id];
    this.forEachField(function(fieldName) {
      rVal.push(fieldName);
    });
    return rVal;
  };
  this.highlightFieldList = function() {
    return this.highlights;
  };
  this.forEachField = function(innerBody) {
    if (this.hasOwnProperty("title")) {
      innerBody(this.title);
    }
    if (this.hasOwnProperty("thumb")) {
      innerBody(this.thumb);
    }
    if (this.hasOwnProperty("image")) {
      innerBody(this.image);
    }
    if (this.embeds) {
      this.embeds.forEach(function(embed) {
        innerBody(embed);
      });
    }
    if (this.translations) {
      this.translations.forEach(function(translate) {
        innerBody(translate);
      });
    }
    if (this.unabridgeds) {
      this.unabridgeds.forEach(function(unabridged) {
        innerBody(unabridged);
      });
    }
    if (this.highlights) {
      this.highlights.forEach(function(hl) {
        innerBody(hl);
      });
    }
    if (this.subs && this.subs !== "*") {
      this.subs.forEach(function(sub) {
        innerBody(sub);
      });
    }
    if (this.functions) {
      this.functions.forEach(function(func) {
        innerBody(func);
      });
    }
  };
};
var transformFieldSpec = function(fieldSpecStr) {
  const defFieldSpec = "id:id title:id *";
  if (fieldSpecStr === null || fieldSpecStr.trim().length === 0) {
    return defFieldSpec;
  }
  const fieldSpecs = fieldSpecStr.split(/[\s,]+/);
  if (fieldSpecs[0] === "*") {
    return defFieldSpec;
  }
  return fieldSpecStr;
};
function createFieldSpec(fieldSpecStr) {
  fieldSpecStr = transformFieldSpec(fieldSpecStr);
  return new FieldSpec(fieldSpecStr);
}
var fieldSpecSvc = { createFieldSpec };

// services/vectorSvc.js
var SparseVector = function() {
  this.vecObj = {};
  let asStr = "";
  const setDirty = function() {
    asStr = "";
  };
  this.set = function(key, value) {
    this.vecObj[key] = value;
    setDirty();
  };
  this.get = function(key) {
    if (this.vecObj.hasOwnProperty(key)) {
      return this.vecObj[key];
    }
    return void 0;
  };
  this.add = function(key, value) {
    if (this.vecObj.hasOwnProperty(key)) {
      this.vecObj[key] += value;
    } else {
      this.vecObj[key] = value;
    }
    setDirty();
  };
  this.toStr = function() {
    if (asStr === "") {
      const sortedL = [];
      Object.keys(this.vecObj).forEach((k) => {
        sortedL.push([k, this.vecObj[k]]);
      });
      sortedL.sort(function(lhs, rhs) {
        return rhs[1] - lhs[1];
      });
      sortedL.forEach(function(keyVal) {
        asStr += keyVal[1] + " " + keyVal[0] + "\n";
      });
    }
    return asStr;
  };
};
function create() {
  return new SparseVector();
}
function add(lhs, rhs) {
  const rVal = create();
  Object.keys(lhs.vecObj).forEach((k) => {
    rVal.set(k, lhs.vecObj[k]);
  });
  Object.keys(rhs.vecObj).forEach((k) => {
    rVal.set(k, rhs.vecObj[k]);
  });
  return rVal;
}
function sumOf(lhs, rhs) {
  const rVal = create();
  Object.keys(lhs.vecObj).forEach((k) => {
    rVal.add(k, lhs.vecObj[k]);
  });
  Object.keys(rhs.vecObj).forEach((k) => {
    rVal.add(k, rhs.vecObj[k]);
  });
  return rVal;
}
function scale(lhs, scalar) {
  const rVal = create();
  Object.keys(lhs.vecObj).forEach((k) => {
    rVal.set(k, lhs.vecObj[k] * scalar);
  });
  return rVal;
}
var vectorSvc = { create, add, sumOf, scale };

// services/baseExplainSvc.js
var Explain = function(explJson, explFactory) {
  const datExplain = this;
  this.asJson = explJson;
  this.realContribution = this.score = parseFloat(explJson.value);
  this.realExplanation = this.description = explJson.description;
  let details = [];
  if (explJson.hasOwnProperty("details")) {
    details = explJson.details;
  }
  this.children = [];
  details.forEach(function(detail) {
    const expl = explFactory(detail);
    if (expl) {
      datExplain.children.push(expl);
    }
  });
  this.influencers = function() {
    return [];
  };
  this.contribution = function() {
    return this.realContribution;
  };
  this.explanation = function() {
    return this.realExplanation;
  };
  this.hasMatch = function() {
    return false;
  };
  this.vectorize = function() {
    const rVal = vectorSvc.create();
    rVal.set(this.explanation(), this.contribution());
    return rVal;
  };
  const mergeInto = function(sink, source) {
    for (const attrname in source) {
      sink[attrname] = source[attrname];
    }
    return sink;
  };
  this.matchDetails = function() {
    const rVal = {};
    this.children.forEach(function(child) {
      mergeInto(rVal, child.matchDetails());
    });
    return rVal;
  };
  let asStr = "";
  let asRawStr = "";
  this.toStr = function(depth) {
    if (asStr === "") {
      if (depth === void 0) {
        depth = 0;
      }
      const prefix = new Array(2 * depth).join(" ");
      const me = prefix + this.contribution() + " " + this.explanation() + "\n";
      const childStrs = [];
      this.influencers().forEach(function(child) {
        childStrs.push(child.toStr(depth + 1));
      });
      asStr = me + childStrs.join("\n");
    }
    return asStr;
  };
  this.rawStr = function() {
    if (asRawStr === "") {
      asRawStr = JSON.stringify(this.asJson);
    }
    return asRawStr;
  };
};
var baseExplainSvc = {
  Explain
};

// services/simExplainSvc.js
var DefaultSimilarityMatch = function(children) {
  let infl = children;
  if (children.length === 1 && children[0].explanation().startsWith("Score")) {
    infl = children[0].children;
  }
  this.fieldWeight = null;
  this.queryWeight = null;
  const match = this;
  infl.forEach(function(child) {
    if (child.explanation() === "Field Weight") {
      match.fieldWeight = child;
    } else if (child.explanation() === "Query Weight") {
      match.queryWeight = child;
    }
  });
  this.formulaStr = function() {
    return "TF=" + this.fieldWeight.tf().contribution() + " * IDF=" + this.fieldWeight.idf().contribution();
  };
};
var tfIdfable = function(explain2) {
  let tfExpl = null;
  let idfExpl = null;
  explain2.children.forEach(function(child) {
    if (child.explanation().startsWith("Term")) {
      tfExpl = child;
    } else if (child.explanation().startsWith("IDF")) {
      idfExpl = child;
    }
  });
  explain2.tf = function() {
    return tfExpl;
  };
  explain2.idf = function() {
    return idfExpl;
  };
  return explain2;
};
var ScoreExplain = function() {
  this.realExplanation = "Score";
};
var FieldWeightExplain = function() {
  this.realExplanation = "Field Weight";
  tfIdfable(this);
};
var QueryWeightExplain = function() {
  this.realExplanation = "Query Weight";
  tfIdfable(this);
};
var DefaultSimTfExplain = function() {
  const termFreq = this.children[0].contribution();
  this.realExplanation = "Term Freq Score (" + termFreq + ")";
};
var DefaultSimIdfExplain = function(explJson) {
  const desc = explJson.description;
  if (this.children.length > 1 && desc.includes("sum of:")) {
    this.realExplanation = "IDF Score";
    this.influencers = function() {
      return this.children;
    };
  } else {
    const idfRegex = /idf\(docFreq=(\d+),.*maxDocs=(\d+)\)/;
    const matches = desc.match(idfRegex);
    if (matches !== null && matches.length > 1) {
      this.realExplanation = "IDF Score";
    } else {
      this.realExplanation = desc;
    }
  }
};
var simExplainSvc = {
  DefaultSimilarityMatch,
  ScoreExplain,
  FieldWeightExplain,
  QueryWeightExplain,
  DefaultSimTfExplain,
  DefaultSimIdfExplain
};

// services/queryExplainSvc.js
var DefaultSimilarityMatch2 = simExplainSvc.DefaultSimilarityMatch;
var MatchAllDocsExplain = function() {
  this.realExplanation = "Match All Docs (*:*)";
};
var ConstantScoreExplain = function() {
  this.realExplanation = "Constant Scored Query";
};
var EsFuncWeightExplain = function(explJson) {
  this.realExplanation = "f( -- constant weight -- ) = " + explJson.value;
};
var shallowArrayCopy = function(src) {
  return src.slice(0);
};
var WeightExplain = function(explJson) {
  const weightRegex2 = /^weight\((?!FunctionScoreQuery).*/;
  const description = explJson.description;
  const match = description.match(weightRegex2);
  if (match !== null && match.length > 1) {
    this.realExplanation = match[1];
  } else {
    this.realExplanation = description;
    const prodOf = ", product of:";
    if (description.endsWith(prodOf)) {
      const len = description.length - prodOf.length;
      this.realExplanation = description.substring(0, len);
    }
  }
  this.hasMatch = function() {
    return true;
  };
  this.getMatch = function() {
    if (this.description.includes("DefaultSimilarity")) {
      return new DefaultSimilarityMatch2(this.children);
    }
    return null;
  };
  this.explanation = function() {
    return this.realExplanation;
  };
  this.matchDetails = function() {
    const rVal = {};
    rVal[this.explanation()] = this.rawStr();
    return rVal;
  };
};
var FunctionQueryExplain = function(explJson) {
  const funcQueryRegex = /FunctionQuery\((.*)\)/;
  const description = explJson.description;
  const match = description.match(funcQueryRegex);
  if (match !== null && match.length > 1) {
    this.realExplanation = match[1];
  } else {
    this.realExplanation = description;
  }
};
var EsFieldFunctionQueryExplain = function(explJson) {
  const funcQueryRegex = /Function for field (.*?):/;
  const description = explJson.description;
  const match = description.match(funcQueryRegex);
  let fieldName = "unknown";
  if (match !== null && match.length > 1) {
    fieldName = match[1];
  }
  let explText = "f(" + fieldName + ") = ";
  this.children.forEach(function(child) {
    explText += child.description + " ";
  });
  this.realExplanation = explText;
};
var MinExplain = function() {
  this.realExplanation = "Minimum Of:";
  this.influencers = function() {
    const infl = shallowArrayCopy(this.children);
    infl.sort(function(a, b) {
      return a.score - b.score;
    });
    return [infl[0]];
  };
  this.vectorize = function() {
    const infl = this.influencers();
    const minInfl = infl[0];
    return minInfl.vectorize();
  };
};
var CoordExplain = function(explJson, coordFactor) {
  if (coordFactor < 1) {
    this.realExplanation = "Matches Punished by " + coordFactor + " (not all query terms matched)";
    this.influencers = function() {
      const infl = [];
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].description.includes("coord")) {
          continue;
        } else {
          infl.push(this.children[i]);
        }
      }
      return infl;
    };
    this.vectorize = function() {
      let rVal = vectorSvc.create();
      this.influencers().forEach(function(infl) {
        rVal = vectorSvc.add(rVal, infl.vectorize());
      });
      rVal = vectorSvc.scale(rVal, coordFactor);
      return rVal;
    };
  }
};
var DismaxTieExplain = function(explJson, tie) {
  this.realExplanation = "Dismax (max plus:" + tie + " times others)";
  this.influencers = function() {
    const infl = shallowArrayCopy(this.children);
    infl.sort(function(a, b) {
      return b.score - a.score;
    });
    return infl;
  };
  this.vectorize = function() {
    const infl = this.influencers();
    let rVal = infl[0].vectorize();
    infl.slice(1).forEach(function(currInfl) {
      const vInfl = currInfl.vectorize();
      const vInflScaled = vectorSvc.scale(vInfl, tie);
      rVal = vectorSvc.add(rVal, vInflScaled);
    });
    return rVal;
  };
};
var DismaxExplain = function() {
  this.realExplanation = "Dismax (take winner of below)";
  this.influencers = function() {
    const infl = shallowArrayCopy(this.children);
    infl.sort(function(a, b) {
      return b.score - a.score;
    });
    return infl;
  };
  this.vectorize = function() {
    const infl = this.influencers();
    return infl[0].vectorize();
  };
};
var SumExplain = function() {
  this.realExplanation = "Sum of the following:";
  this.isSumExplain = true;
  this.influencers = function() {
    const infl = [];
    this.children.forEach(function(child) {
      if (child.hasOwnProperty("isSumExplain") && child.isSumExplain) {
        child.influencers().forEach(function(grandchild) {
          infl.push(grandchild);
        });
      } else {
        infl.push(child);
      }
    });
    return infl.sort(function(a, b) {
      return b.score - a.score;
    });
  };
  this.vectorize = function() {
    let rVal = vectorSvc.create();
    this.influencers().forEach(function(infl) {
      rVal = vectorSvc.sumOf(rVal, infl.vectorize());
    });
    return rVal;
  };
};
var ProductExplain = function() {
  this.realExplanation = "Product of following:";
  const oneFilled = function(length) {
    return Array.apply(null, new Array(length)).map(Number.prototype.valueOf, 1);
  };
  this.influencers = function() {
    const infl = shallowArrayCopy(this.children);
    infl.sort(function(a, b) {
      return b.score - a.score;
    });
    return infl;
  };
  this.vectorize = function() {
    let rVal = vectorSvc.create();
    const infl = this.influencers();
    const inflFactors = oneFilled(infl.length);
    for (let factorInfl = 0; factorInfl < infl.length; factorInfl++) {
      for (let currMult = 0; currMult < infl.length; currMult++) {
        if (currMult !== factorInfl) {
          inflFactors[factorInfl] = inflFactors[factorInfl] * infl[currMult].contribution();
        }
      }
    }
    for (let currInfl = 0; currInfl < infl.length; currInfl++) {
      const i = infl[currInfl];
      const thisVec = i.vectorize();
      const thisScaledByOthers = vectorSvc.scale(thisVec, inflFactors[currInfl]);
      rVal = vectorSvc.add(rVal, thisScaledByOthers);
    }
    return rVal;
  };
};
var queryExplainSvc = {
  MatchAllDocsExplain,
  ConstantScoreExplain,
  WeightExplain,
  FunctionQueryExplain,
  DismaxTieExplain,
  DismaxExplain,
  SumExplain,
  CoordExplain,
  ProductExplain,
  MinExplain,
  EsFieldFunctionQueryExplain,
  EsFuncWeightExplain
};

// services/explainSvc.js
var Explain2 = baseExplainSvc.Explain;
var ConstantScoreExplain2 = queryExplainSvc.ConstantScoreExplain;
var MatchAllDocsExplain2 = queryExplainSvc.MatchAllDocsExplain;
var WeightExplain2 = queryExplainSvc.WeightExplain;
var FunctionQueryExplain2 = queryExplainSvc.FunctionQueryExplain;
var DismaxTieExplain2 = queryExplainSvc.DismaxTieExplain;
var DismaxExplain2 = queryExplainSvc.DismaxExplain;
var SumExplain2 = queryExplainSvc.SumExplain;
var CoordExplain2 = queryExplainSvc.CoordExplain;
var ProductExplain2 = queryExplainSvc.ProductExplain;
var MinExplain2 = queryExplainSvc.MinExplain;
var EsFieldFunctionQueryExplain2 = queryExplainSvc.EsFieldFunctionQueryExplain;
var EsFuncWeightExplain2 = queryExplainSvc.EsFuncWeightExplain;
var FieldWeightExplain2 = simExplainSvc.FieldWeightExplain;
var QueryWeightExplain2 = simExplainSvc.QueryWeightExplain;
var DefaultSimTfExplain2 = simExplainSvc.DefaultSimTfExplain;
var DefaultSimIdfExplain2 = simExplainSvc.DefaultSimIdfExplain;
var ScoreExplain2 = simExplainSvc.ScoreExplain;
var meOrOnlyChild = function(explain2) {
  const infl = explain2.influencers();
  if (infl.length === 1) {
    return infl[0];
  } else {
    return explain2;
  }
};
var replaceBadExplanationJson = function(explJson) {
  const explJsonIfBad = {
    details: [],
    description: "no explain for doc",
    value: 0,
    match: true
  };
  if (!explJson || Object.keys(explJson).length === 0) {
    return explJsonIfBad;
  } else {
    return explJson;
  }
};
var tieRegex = /max plus ([0-9.]+) times/;
var prefixRegex = /\:.*?\*(\^.+?)?, product of/;
var weightRegex = /^weight\((?!FunctionScoreQuery).*/;
var createExplain = function(explJson) {
  explJson = replaceBadExplanationJson(explJson);
  const base = new Explain2(explJson, createExplain);
  const description = explJson.description;
  let details = [];
  const IGNORED = null;
  const tieMatch = description.match(tieRegex);
  const prefixMatch = description.match(prefixRegex);
  const weightMatch = description.match(weightRegex);
  if (explJson.hasOwnProperty("details")) {
    details = explJson.details;
  }
  if (description.startsWith("score(")) {
    ScoreExplain2.prototype = base;
    return new ScoreExplain2(explJson);
  }
  if (description.startsWith("tf(")) {
    DefaultSimTfExplain2.prototype = base;
    return new DefaultSimTfExplain2(explJson);
  } else if (description.startsWith("idf(")) {
    DefaultSimIdfExplain2.prototype = base;
    return new DefaultSimIdfExplain2(explJson);
  } else if (description.startsWith("fieldWeight")) {
    FieldWeightExplain2.prototype = base;
    return new FieldWeightExplain2(explJson);
  } else if (description.startsWith("queryWeight")) {
    QueryWeightExplain2.prototype = base;
    return new QueryWeightExplain2(explJson);
  }
  if (description.startsWith("ConstantScore")) {
    ConstantScoreExplain2.prototype = base;
    return new ConstantScoreExplain2(explJson);
  } else if (description.startsWith("MatchAllDocsQuery")) {
    MatchAllDocsExplain2.prototype = base;
    return new MatchAllDocsExplain2(explJson);
  } else if (weightMatch !== null) {
    WeightExplain2.prototype = base;
    return new WeightExplain2(explJson);
  } else if (description.startsWith("weight(FunctionScoreQuery(")) {
    if (details.length === 1) {
      return meOrOnlyChild(new ProductExplain2(explJson));
    } else {
      WeightExplain2.prototype = base;
      return new WeightExplain2(explJson);
    }
  } else if (description.startsWith("FunctionQuery")) {
    FunctionQueryExplain2.prototype = base;
    return new FunctionQueryExplain2(explJson);
  } else if (description.startsWith("Function for field")) {
    EsFieldFunctionQueryExplain2.prototype = base;
    return new EsFieldFunctionQueryExplain2(explJson);
  } else if (prefixMatch && prefixMatch.length > 1) {
    WeightExplain2.prototype = base;
    return new WeightExplain2(explJson);
  } else if (description.startsWith("match on required clause") || description.startsWith("match filter")) {
    return IGNORED;
  } else if (description.startsWith("queryBoost")) {
    if (explJson.value === 1) {
      return IGNORED;
    }
  } else if (description.includes("constant score") && description.includes("no function provided")) {
    return IGNORED;
  } else if (description === "weight") {
    EsFuncWeightExplain2.prototype = base;
    return new EsFuncWeightExplain2(explJson);
  } else if (tieMatch && tieMatch.length > 1) {
    const tie = parseFloat(tieMatch[1]);
    DismaxTieExplain2.prototype = base;
    return new DismaxTieExplain2(explJson, tie);
  } else if (description.includes("max of")) {
    DismaxExplain2.prototype = base;
    return meOrOnlyChild(new DismaxExplain2(explJson));
  } else if (description.includes("sum of")) {
    SumExplain2.prototype = base;
    return meOrOnlyChild(new SumExplain2(explJson));
  } else if (description.includes("Math.min of")) {
    MinExplain2.prototype = base;
    return meOrOnlyChild(new MinExplain2(explJson));
  } else if (description.includes("min of")) {
    MinExplain2.prototype = base;
    return meOrOnlyChild(new MinExplain2(explJson));
  } else if (description.includes("score mode [multiply]")) {
    ProductExplain2.prototype = base;
    return meOrOnlyChild(new ProductExplain2(explJson));
  } else if (description.includes("product of")) {
    let coordExpl = null;
    if (details.length === 2) {
      details.forEach(function(detail) {
        if (detail.description.startsWith("coord(")) {
          CoordExplain2.prototype = base;
          coordExpl = new CoordExplain2(explJson, parseFloat(detail.value));
        }
      });
    }
    if (coordExpl !== null) {
      return coordExpl;
    } else {
      ProductExplain2.prototype = base;
      return meOrOnlyChild(new ProductExplain2(explJson));
    }
  }
  return base;
};
var explainSvc = {
  createExplain: function(explJson) {
    return createExplain(explJson);
  }
};

// services/normalDocsSvc.js
var multiIndex = function(obj, keys) {
  if (keys.length === 0) {
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(function(child) {
      return multiIndex(child, keys);
    });
  } else {
    return multiIndex(obj[keys[0]], keys.slice(1));
  }
};
var pathIndex = function(obj, keys) {
  if (obj.hasOwnProperty(keys)) {
    return obj[keys];
  } else {
    return multiIndex(obj, keys.split("."));
  }
};
var assignSingleField = function(normalDoc, doc, field, toProperty) {
  if (/\./.test(field)) {
    try {
      const value = pathIndex(doc, field);
      normalDoc[toProperty] = "" + value;
    } catch (e) {
      normalDoc[toProperty] = "";
    }
  } else if (doc.hasOwnProperty(field)) {
    normalDoc[toProperty] = "" + doc[field];
  }
};
var fieldDisplayName = function(funcFieldQuery) {
  return funcFieldQuery.split(":")[0];
};
var assignEmbeds = function(normalDoc, doc, fieldSpec) {
  (fieldSpec.embeds || []).forEach(function(embedField) {
    normalDoc.embeds[embedField] = doc[embedField];
  });
};
var assignTranslations = function(normalDoc, doc, fieldSpec) {
  (fieldSpec.translations || []).forEach(function(translationField) {
    normalDoc.translations[translationField] = doc[translationField];
  });
};
var assignUnabridgeds = function(normalDoc, doc, fieldSpec) {
  (fieldSpec.unabridgeds || []).forEach(function(unabridgedField) {
    normalDoc.unabridgeds[unabridgedField] = doc[unabridgedField];
  });
};
var assignSubs = function(normalDoc, doc, fieldSpec) {
  const parseValue = function(value) {
    if (typeof value === "object") {
      return value;
    } else {
      return "" + value;
    }
  };
  if (fieldSpec.subs === "*") {
    Object.keys(doc).forEach(function(fieldName) {
      const value = doc[fieldName];
      if (typeof value !== "function") {
        if (fieldName !== fieldSpec.id && fieldName !== fieldSpec.title && fieldName !== fieldSpec.thumb && fieldName !== fieldSpec.image) {
          normalDoc.subs[fieldName] = parseValue(value);
        }
      }
    });
  } else {
    (fieldSpec.subs || []).forEach(function(subFieldName) {
      if (/\./.test(subFieldName)) {
        try {
          const value = pathIndex(doc, subFieldName);
          normalDoc.subs[subFieldName] = parseValue(value);
        } catch (e) {
          console.error(e);
          normalDoc.subs[subFieldName] = "";
        }
      } else if (doc.hasOwnProperty(subFieldName)) {
        normalDoc.subs[subFieldName] = parseValue(doc[subFieldName]);
      }
    });
    (fieldSpec.functions || []).forEach(function(functionField) {
      const dispName = fieldDisplayName(functionField);
      if (doc.hasOwnProperty(dispName)) {
        normalDoc.subs[dispName] = parseValue(doc[dispName]);
      }
    });
    (fieldSpec.highlights || []).forEach(function(hlField) {
      if (fieldSpec.title !== hlField) {
        normalDoc.subs[hlField] = parseValue(doc[hlField]);
      }
    });
  }
};
var assignFields = function(normalDoc, doc, fieldSpec) {
  assignSingleField(normalDoc, doc, fieldSpec.id, "id");
  assignSingleField(normalDoc, doc, fieldSpec.title, "title");
  assignSingleField(normalDoc, doc, fieldSpec.thumb, "thumb");
  assignSingleField(normalDoc, doc, fieldSpec.image, "image");
  if (fieldSpec.image_options) {
    normalDoc.image_options = fieldSpec.image_options;
  }
  if (fieldSpec.thumb_options) {
    normalDoc.thumb_options = fieldSpec.thumb_options;
  }
  normalDoc.titleField = fieldSpec.title;
  normalDoc.embeds = {};
  assignEmbeds(normalDoc, doc, fieldSpec);
  normalDoc.translations = {};
  assignTranslations(normalDoc, doc, fieldSpec);
  normalDoc.unabridgeds = {};
  assignUnabridgeds(normalDoc, doc, fieldSpec);
  normalDoc.subs = {};
  assignSubs(normalDoc, doc, fieldSpec);
};
var NormalDoc = function(fieldSpec, doc) {
  this.doc = doc;
  assignFields(this, this.doc.origin(), fieldSpec);
  let hasThumb = false;
  if (this.hasOwnProperty("thumb")) {
    hasThumb = true;
  }
  let hasImage = false;
  if (this.hasOwnProperty("image")) {
    hasImage = true;
  }
  this.subsList = [];
  const thisNormalDoc = this;
  Object.keys(this.subs).forEach(function(subField) {
    const subValue = thisNormalDoc.subs[subField];
    const expanded = { field: subField, value: subValue };
    thisNormalDoc.subsList.push(expanded);
  });
  this.hasThumb = function() {
    return hasThumb;
  };
  this.hasImage = function() {
    return hasImage;
  };
  this._url = function() {
    return this.doc._url(fieldSpec.id, this.id);
  };
};
var getHighlightSnippet = function(aDoc, docId, subFieldName, subFieldValue, hlPre, hlPost) {
  let snip = aDoc.highlight(docId, subFieldName, hlPre, hlPost);
  if (null === snip || void 0 === snip || "" === snip) {
    snip = escapeHtml(subFieldValue.slice(0, 200));
  }
  return snip;
};
var snippitable = function(doc) {
  const aDoc = doc.doc;
  const lastSubSnips = {};
  let lastHlPre = null;
  let lastHlPost = null;
  doc.getHighlightedTitle = function(hlPre, hlPost) {
    return doc.title ? getHighlightSnippet(aDoc, doc.id, doc.titleField, doc.title, hlPre, hlPost) : null;
  };
  doc.subSnippets = function(hlPre, hlPost) {
    if (lastHlPre !== hlPre || lastHlPost !== hlPost) {
      const displayFields = Object.assign({}, doc.subs);
      Object.keys(displayFields).forEach(function(subFieldName) {
        const subFieldValue = displayFields[subFieldName];
        if (typeof subFieldValue === "object" && !(subFieldValue instanceof Array)) {
          lastSubSnips[subFieldName] = subFieldValue;
        } else {
          const snip = getHighlightSnippet(
            aDoc,
            doc.id,
            subFieldName,
            subFieldValue,
            hlPre,
            hlPost
          );
          lastSubSnips[subFieldName] = snip;
        }
      });
      lastHlPre = hlPre;
      lastHlPost = hlPost;
    }
    return lastSubSnips;
  };
  return doc;
};
var explainable = function(doc, explainJson) {
  let simplerExplain = null;
  let hotMatches = null;
  let matchDetails = null;
  const initExplain = function() {
    if (!simplerExplain) {
      simplerExplain = explainSvc.createExplain(explainJson);
      hotMatches = simplerExplain.vectorize();
      matchDetails = simplerExplain.matchDetails();
    }
  };
  doc.explain = function() {
    initExplain();
    return simplerExplain;
  };
  doc.hotMatches = function() {
    initExplain();
    return hotMatches;
  };
  doc.matchDetails = function() {
    initExplain();
    return matchDetails;
  };
  const hotOutOf = [];
  let lastMaxScore = -1;
  doc.hotMatchesOutOf = function(maxScore) {
    initExplain();
    if (maxScore !== lastMaxScore) {
      hotOutOf.length = 0;
    }
    lastMaxScore = maxScore;
    if (hotOutOf.length === 0) {
      Object.keys(hotMatches.vecObj).forEach(function(key) {
        const value = hotMatches.vecObj[key];
        const percentage = (0 + value) / maxScore * 100;
        hotOutOf.push({ description: key, metadata: matchDetails[key], percentage });
      });
      hotOutOf.sort(function(a, b) {
        return b.percentage - a.percentage;
      });
    }
    return hotOutOf;
  };
  doc.score = function() {
    initExplain();
    return simplerExplain.contribution();
  };
  return doc;
};
var getDocExplain = function(doc, nDoc) {
  const explJson = doc.explain(nDoc.id);
  if (explJson === null) {
    if (doc.origin().hasOwnProperty("id")) {
      return doc.explain(doc.origin().id);
    }
  }
  return explJson;
};
function createNormalDoc(fieldSpec, doc, altExplainJson) {
  const nDoc = new NormalDoc(fieldSpec, doc);
  let explJson;
  if (altExplainJson) {
    explJson = altExplainJson;
  } else {
    explJson = getDocExplain(doc, nDoc);
  }
  return snippetDoc(explainDoc(nDoc, explJson));
}
function explainDoc(doc, explainJson) {
  return explainable(doc, explainJson);
}
function snippetDoc(doc) {
  return snippitable(doc);
}
function createPlaceholderDoc(docId, stubTitle, explainJson) {
  const placeHolder = { id: docId, title: stubTitle };
  if (explainJson) {
    return snippitable(explainable(placeHolder, explainJson));
  } else {
    placeHolder.subSnippets = function() {
      return "";
    };
    return placeHolder;
  }
}
var normalDocsSvc = { createNormalDoc, explainDoc, snippetDoc, createPlaceholderDoc };

// factories/resolverFactory.js
var Resolver = function(ids, settings, chunkSize) {
  const self = this;
  self.settings = settings;
  self.ids = ids;
  self.docs = [];
  self.args = {};
  self.config = {};
  self.queryText = null;
  self.fieldSpec = self.settings.createFieldSpec();
  self.chunkSize = chunkSize;
  self.fetchDocs = fetchDocs;
  if (self.settings.searchEngine === void 0 || self.settings.searchEngine === "solr") {
    let allIdsLuceneQuery = self.fieldSpec.id + ":(";
    allIdsLuceneQuery += ids.join(" OR ");
    allIdsLuceneQuery += ")";
    self.queryText = allIdsLuceneQuery;
    self.args = {
      defType: ["lucene"],
      rows: [ids.length],
      q: ["#$query##"]
    };
  } else if (settings.searchEngine === "es" || settings.searchEngine === "os") {
    self.args = {
      query: {
        terms: {
          [self.fieldSpec.id]: ids
        }
      },
      size: ids.length
    };
  } else if (settings.searchEngine === "vectara" || settings.searchEngine === "searchapi") {
  } else if (settings.searchEngine === "algolia") {
    self.args = {
      objectIds: ids,
      retrieveObjects: true
    };
  }
  self.config = {
    sanitize: false,
    highlight: false,
    debug: false,
    escapeQuery: false,
    numberOfRows: ids.length,
    version: self.settings.version,
    proxyUrl: self.settings.proxyUrl,
    customHeaders: self.settings.customHeaders,
    basicAuthCredential: self.settings.basicAuthCredential,
    apiMethod: self.settings.apiMethod
  };
  self.searcher = searchSvc.createSearcher(
    self.fieldSpec,
    self.settings.searchUrl,
    self.args,
    self.queryText,
    self.config,
    self.settings.searchEngine
  );
  function fetchDocs() {
    if (self.chunkSize === void 0) {
      return self.searcher.search().then(function() {
        const newDocs = self.searcher.docs;
        self.docs.length = 0;
        const idsToDocs = {};
        newDocs.forEach(function(doc) {
          const normalDoc = normalDocsSvc.createNormalDoc(self.fieldSpec, doc);
          idsToDocs[normalDoc.id] = normalDoc;
        });
        ids.forEach(function(docId) {
          if (idsToDocs.hasOwnProperty(docId)) {
            self.docs.push(idsToDocs[docId]);
          } else {
            const placeholderTitle = "Missing Doc: " + docId;
            const placeholderDoc = normalDocsSvc.createPlaceholderDoc(docId, placeholderTitle);
            self.docs.push(placeholderDoc);
          }
        });
        return self.docs;
      }).catch(function(response) {
        console.debug("Failed to fetch docs");
        return Promise.reject(response);
      });
    } else {
      const sliceIds = function(ids2, chunkSize2) {
        if (chunkSize2 > 0) {
          const slices = [];
          for (let i = 0; i < ids2.length; i += chunkSize2) {
            slices.push(ids2.slice(i, i + chunkSize2));
          }
          return slices;
        }
      };
      const promises = sliceIds(ids, chunkSize).map(function(sliceOfIds) {
        const resolver = new Resolver(sliceOfIds, settings);
        return resolver.fetchDocs();
      });
      return Promise.all(promises).then(function(docsChunks) {
        self.docs.length = 0;
        docsChunks.forEach(function(chunk) {
          chunk.forEach(function(doc) {
            self.docs.push(doc);
          });
        });
      }).catch(function(response) {
        console.debug("Failed to fetch docs");
        return Promise.reject(response);
      });
    }
  }
};
var resolverFactory_default = Resolver;

// services/docResolverSvc.js
function createResolver(ids, settings, chunkSize) {
  return new resolverFactory_default(ids, settings, chunkSize);
}
var docResolverSvc = { createResolver };

// services/solrExplainExtractorSvc.js
function getOverridingExplain(doc, fieldSpec, explainData) {
  const idFieldName = fieldSpec.id;
  const id = doc[idFieldName];
  if (id && explainData && explainData.hasOwnProperty(id)) {
    return explainData[id];
  }
  return null;
}
function docsWithExplainOther(docs, fieldSpec, explainData) {
  const parsedDocs = [];
  docs.forEach(function(doc) {
    const overridingExplain = getOverridingExplain(doc, fieldSpec, explainData);
    const normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc, overridingExplain);
    parsedDocs.push(normalDoc);
  });
  return parsedDocs;
}
var solrExplainExtractorSvc = { getOverridingExplain, docsWithExplainOther };

// services/esExplainExtractorSvc.js
function docsWithExplainOther2(docs, fieldSpec) {
  const parsedDocs = [];
  docs.forEach(function(doc) {
    const normalDoc = normalDocsSvc.createNormalDoc(fieldSpec, doc);
    parsedDocs.push(normalDoc);
  });
  return parsedDocs;
}
var esExplainExtractorSvc = { docsWithExplainOther: docsWithExplainOther2 };

// factories/settingsValidatorFactory.js
function SettingsValidatorFactory(settings) {
  const self = this;
  self.searchUrl = settings.searchUrl;
  self.searchEngine = settings.searchEngine;
  self.apiMethod = settings.apiMethod;
  self.version = settings.version;
  self.customHeaders = settings.customHeaders;
  self.settings = settings;
  if (settings.args) {
    self.args = settings.args;
  }
  self.searcher = null;
  self.fields = [];
  self.idFields = [];
  self.setupSearcher = setupSearcher;
  self.validateUrl = validateUrl;
  self.setupSearcher();
  function setupSearcher() {
    let args = {};
    let fields = "*";
    if (self.args) {
      args = self.args;
    }
    if (self.searchEngine === "solr") {
      args = { q: ["*:*"] };
    } else if (self.searchEngine === "es" || self.searchEngine === "os") {
      fields = null;
    } else if (self.searchEngine === "vectara") {
      args = {
        query: [
          {
            query: "#$query##",
            numResults: 10,
            corpusKey: [
              {
                corpusId: 1
              }
            ]
          }
        ]
      };
    }
    self.searcher = searchSvc.createSearcher(
      fieldSpecSvc.createFieldSpec(fields),
      self.searchUrl,
      args,
      "",
      self.settings,
      self.searchEngine
    );
  }
  function sourceDoc(doc) {
    if (self.searchEngine === "solr") {
      return doc.doc;
    } else if (self.searchEngine === "es" || self.searchEngine === "os") {
      return doc.doc._source;
    } else if (self.searchEngine === "vectara") {
      const fieldsFromDocumentMetadata = doc.doc.metadata.reduce(function(map, obj) {
        map[obj.name] = obj.value;
        return map;
      }, {});
      return Object.assign(
        {},
        {
          id: doc.doc.id
        },
        fieldsFromDocumentMetadata
      );
    } else if (self.searchEngine === "searchapi") {
      return doc.doc;
    } else if (self.searchEngine === "algolia") {
      return doc.doc;
    } else {
      console.error(
        "Need to determine how to source a doc for this search engine " + self.searchEngine
      );
    }
  }
  function intersection(a, b) {
    const intersect = a.filter(function(aVal) {
      return b.indexOf(aVal) !== -1;
    });
    return intersect;
  }
  function updateCandidateIds(candidateIds, attributes) {
    if (candidateIds === void 0) {
      return attributes;
    }
    return intersection(candidateIds, attributes);
  }
  function validateUrl() {
    return self.searcher.search().then(function() {
      let candidateIds;
      self.searcher.docs.forEach(function(doc) {
        const attributes = Object.keys(sourceDoc(doc));
        candidateIds = updateCandidateIds(candidateIds, attributes);
        self.fields = self.fields.concat(
          attributes.filter(function(attribute) {
            return self.fields.indexOf(attribute) < 0;
          })
        );
      });
      self.idFields = candidateIds;
      if (self.searchEngine === "es" || self.searchEngine === "os") {
        self.fields.unshift("_id");
        self.idFields.unshift("_id");
      }
    });
  }
}
var settingsValidatorFactory_default = SettingsValidatorFactory;
export {
  algoliaSearchFactory_default as AlgoliaSearcherFactory,
  esSearcherFactory_default as EsSearcherFactory,
  resolverFactory_default as ResolverFactory,
  searchApiSearcherFactory_default as SearchApiSearcherFactory,
  settingsValidatorFactory_default as SettingsValidatorFactory,
  solrSearcherFactory_default as SolrSearcherFactory,
  vectaraSearcherFactory_default as VectaraSearcherFactory,
  activeQueries,
  createExplain,
  createFieldSpec,
  createNormalDoc,
  createSearcher,
  defaultESConfig,
  defaultSolrConfig,
  defaultVectaraConfig,
  docResolverSvc,
  esExplainExtractorSvc,
  esUrlSvc,
  explainSvc,
  fieldSpecSvc,
  normalDocsSvc,
  searchSvc,
  solrExplainExtractorSvc,
  solrUrlSvc,
  transportSvc,
  vectaraUrlSvc
};
//# sourceMappingURL=splainer-search.js.map

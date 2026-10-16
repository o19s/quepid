import { renderTextWithLinks } from "utils/html"

const codes = {
  100: "Continue",
  101: "Switching Protocols",
  102: "Processing",
  200: "OK",
  201: "Created",
  202: "Accepted",
  203: "Non-Authoritative Information",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  207: "Multi-Status",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Moved Temporarily",
  303: "See Other",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  406: "Not Acceptable",
  407: "Proxy Authentication Required",
  408: "Request Time-out",
  409: "Conflict",
  410: "Gone",
  411: "Length Required",
  412: "Precondition Failed",
  413: "Request Entity Too Large",
  414: "Request-URI Too Large",
  415: "Unsupported Media Type",
  416: "Requested Range Not Satisfiable",
  417: "Expectation Failed",
  418: "I'm a teapot",
  422: "Unprocessable Entity",
  423: "Locked",
  424: "Failed Dependency",
  425: "Unordered Collection",
  426: "Upgrade Required",
  428: "Precondition Required",
  429: "Too Many Requests",
  431: "Request Header Fields Too Large",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Time-out",
  505: "HTTP Version Not Supported",
  506: "Variant Also Negotiates",
  507: "Insufficient Storage",
  509: "Bandwidth Limit Exceeded",
  510: "Not Extended",
  511: "Network Authentication Required"
}

export function codeToString(code) {
  return Object.prototype.hasOwnProperty.call(codes, code) ? codes[code] : "Unknown Error"
}

export function formatCode(code) {
  if (code > 0) return `[${code}: ${codeToString(code)}]`
  return undefined
}

/**
 * A translated search failure. `parts` is a list of `{ text, href? }` segments
 * so the troubleshooting links stay clickable without treating server/user
 * text as markup; `message` is the same content as plain text.
 */
export class SearchError extends Error {
  constructor(parts) {
    super(parts.map((part) => part.text).join(""))
    this.name = "SearchError"
    this.parts = parts
  }

  // Escaped markup with safe links, for `query.errorText` (rendered through
  // `sanitizeSnippetHtml`).
  toHtml() {
    const container = document.createElement("div")
    container.append(renderTextWithLinks(this.parts))
    return container.innerHTML
  }
}

export function parseResponseObject(response, inspectUrl, searchEngine) {
  if (searchEngine === "solr") {
    return new SearchError([
      { text: "One or more of your Solr queries failed to return results, please access " },
      { text: "Solr instance directly", href: inspectUrl },
      {
        text: " to confirm Solr is accessible and to inspect the error.   If Solr responds, check if you have an ad blocker blocking your queries.  With Solr 8.4.1 and later you need to allow Quepid access to Solr.  Learn more "
      },
      {
        text: "on the troubleshooting Solr wiki page",
        href: "https://github.com/o19s/quepid/wiki/Troubleshooting-Solr-and-Quepid#compatibility-with-nosniff"
      },
      { text: "." }
    ])
  }

  if (response instanceof Error) {
    return new SearchError([{ text: `Search API mapper error: ${response.message}` }])
  }

  if (response.status === -1) {
    return new SearchError([
      { text: "An unexpected error was returned: You may have a typo in your URL (" },
      { text: "Quepid Wiki", href: "https://github.com/o19s/quepid/wiki" },
      {
        text: " for more help). If that is not the case, make sure that CORS is enabled in your config."
      }
    ])
  }

  let error = `An unexpected error was returned: ${formatCode(response.status)}`
  if (Object.prototype.hasOwnProperty.call(response, "statusText"))
    error += ` - ${response.statusText}`
  if (Object.prototype.hasOwnProperty.call(response, "reason")) error += ` - ${response.reason}`

  if (response.data) {
    if (response.data.error && typeof response.data.error === "object") {
      error += `: ${JSON.stringify(response.data.error)}`
    } else if (response.data.error) {
      error += `: ${response.data.error}`
    } else if (response.data.message) {
      error += `: ${response.data.message}`
    }
  }

  return new SearchError([{ text: error }])
}

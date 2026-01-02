Certainly! To convert the raw HTML into the formats Quepid requires, we'll need to parse the HTML and extract the total number of results and the individual results with their IDs and titles.

Since we are assuming a JavaScript environment with no DOMParser, I'll use string operations and regular expressions to extract the necessary data.

Here's the plan:
- `numberOfResultsMapper` will extract the total number of results (which is 1000 for the current page).
- `docsMapper` will extract each individual result's ID and title from the HTML.

Let's generate the code:

```javascript
// Function to extract total number of results from the HTML
const numberOfResultsMapper = function(data) {
  // Use a regular expression to find the total results statement
  const match = data.match(/Found (\d+) results from all University websites\./);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return 0; // default if not found
};

// Function to extract individual results from the HTML
const docsMapper = function(data) {
  const results = [];
  // Use a regular expression to find all result blocks
  const regex = /<h2><a href="([^"]+)">([^<]+)<\/a><\/h2>[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  let idCounter = 1; // fallback ID if real ID is not available

  while ((match = regex.exec(data)) !== null) {
    const url = match[1]; // URL of the result
    const title = match[2]; // Title of the result
    results.push({
      id: url || `result-${idCounter}`,
      title: title,
    });
    idCounter++;
  }
  return results;
};
```

### Explanation:
- `numberOfResultsMapper`: Uses a regex to find the total number of results displayed in the line "Found xxx results from all University websites."
- `docsMapper`: Uses a regex to find all `<h2>` elements containing `<a>` tags, extracting their `href` attribute and inner text. These are the individual search results, with their URL and title.

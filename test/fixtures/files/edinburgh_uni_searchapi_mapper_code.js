// Function to extract total number of search results from HTML content
numberOfResultsMapper = function(html) {
  // Use a regex to find the paragraph containing the results count
  const match = html.match(/<p class="lead">Found (\d+) results from all University websites\.<\/p>/);
  // Return the number as integer, or 0 if not found
  return match ? parseInt(match[1], 10) : 0;
}

// Function to convert the search results HTML into the format required by Quepid
docsMapper = function(html) {
  const results = [];
  // Regex to find each search result block's URL and title
  const regex = /<div class="card card-search">[\s\S]*?<h2 class="card-search-title"><a class="stretched-link" href="([^"]+)">([\s\S]*?)<\/a><\/h2>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]+>/g, ''); // Remove HTML tags if nested
    results.push({
      id: url,
      title: title,
      url: url
    });
  }
  return results;
}

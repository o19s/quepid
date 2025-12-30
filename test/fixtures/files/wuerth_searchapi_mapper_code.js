// numberOfResultsMapper - Returns total number of search results
numberOfResultsMapper = function (data) {
  // This function parses the number of results from a given HTML string.
  // It looks for the productAreaHits value in a JSON-like structure.

  // Find the index of productAreaHits keyword
  var productAreaHitsIndex = data.indexOf("productAreaHits");

  // Return 0 if the productAreaHits keyword is not found
  if (productAreaHitsIndex === -1) {
    return 0;
  }

  // Find the starting index for the number by looking from the productAreaHits position
  var startIndex = data.indexOf(":", productAreaHitsIndex) + 1;

  // Find the ending index for the number by looking for the next comma or closing brace
  var endIndex = data.indexOf(",", startIndex);
  if (endIndex === -1) {
    endIndex = data.indexOf("}", startIndex);
  }

  // Extract the substring representing the number
  var numberString = data.substring(startIndex, endIndex).trim();

  // Parse the integer from the string
  return parseInt(numberString, 10);
};

docsMapper = function (data) {
  var docs = [];

  // Use regex to extract the JSON embedded in the HTML as the variable 'afterSearchVoRaw'
  var jsonVariableStart = data.indexOf("var afterSearchVoRaw = ");
  if (jsonVariableStart !== -1) {
    var jsonVariableEnd = data.indexOf("}';", jsonVariableStart);
    if (jsonVariableEnd !== -1) {
      // Extract the JSON string, remove extra escaping, and parse it.
      var jsonText = data.substring(
        jsonVariableStart + 24,
        jsonVariableEnd + 1,
      );

      jsonText = jsonText.replace(/\\"/g, '\"'); // Remove extra escaping

      try {
        var jsonData = JSON.parse(jsonText);
        var products =
          (jsonData.modelContainer && jsonData.modelContainer.items) || [];

        // Extract data from the products JSON array
        products.forEach(function (product) {
          var doc = {
            id: product.name,
            title: product.displayName,
            url: product.itemUrl,
            description: product.uspText,
            image: product.imageUrl,
          };
          docs.push(doc);
        });
      } catch (e) {
        console.error("Failed to parse JSON data", e);
      }
    }
  }

  // Fallback to parsing HTML result blocks if JSON is not available
  if (docs.length === 0) {
    var blocks = data.split('<div class="resultItem">');
    for (var i = 1; i < blocks.length; i++) {
      var block = blocks[i];
      var titleMatch = block.match(
        /<a[^>]*class="resultTitle"[^>]*>(.*?)<\/a>/,
      );
      var urlMatch = block.match(
        /<a[^>]*href="([^"]+)"[^>]*class="resultTitle">/,
      );
      var descriptionMatch = block.match(
        /<p[^>]*class="resultDescription"[^>]*>(.*?)<\/p>/,
      );
      var imageMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/);

      if (titleMatch && urlMatch) {
        var doc = {
          id: urlMatch[1],
          title: titleMatch[1].replace(/<[^>]+>/g, ""),
        };
        if (descriptionMatch) {
          doc.description = descriptionMatch[1].replace(/<[^>]+>/g, "");
        }
        if (imageMatch) {
          doc.image = imageMatch[1];
        }
        docs.push(doc);
      }
    }
  }

  return docs;
};

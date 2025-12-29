myExtractor = function(data){
  const starttoken = "<div class=\"results\">";
  const endtoken = "<div class=\"results-message\">";
  const startblock1 = "<a class=\"link--primary link\" href=\"";
  const endblock1 = "\" target=\"";
  const startblock2 = "noreferrer\">";
  const endblock2 = "</a>";
  const startblock3 = "\"card__content__summary\">";
  const endblock3 = "</p>";
  
	obj = [];
	str = data;
  	// skip to the beginning of the results and chop out this block
	str2 = str.substring( str.indexOf(starttoken)+starttoken.length);
  str3 = str2.substring(0,str2.indexOf(endtoken)+endtoken.length);
  
  count = 0;
	while (count<10){ // iterate results
  		str4 = str3.substring(str3.indexOf(startblock1)+startblock1.length); // find URL
  		str5 = str4.substring(0,str4.indexOf(endblock1)); // find end of URL & grab
      str6 = str3.substring(str3.indexOf(startblock2)+startblock2.length); // find title
      str7 = str6.substring(0, str6.indexOf(endblock2)); // find end of title and grab
      str8 = str3.substring(str3.indexOf(startblock3)+startblock3.length); // find summary
    	str9 = str8.substring(0,str8.indexOf(endblock3)); // find end of summary & grab
      
  		obj.push ({
    		id: count+1,
   	 		url:str5,
            title: str7,
          	summary: str9
    		});
  		str3 = str8;
  		count++;
  	}

	return obj;
};

numberOfResultsMapper = function(data){
  myExtractor(data).length;
};

docsMapper = function(data){
  let docs = [];
 
  for (let doc of myExtractor(data)) {
  	docs.push ({
     	id: doc.id,
     	title: doc.title,
     	url: doc.url,
     	summary: doc.summary
    });
  }

  return docs;
};

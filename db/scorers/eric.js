//        try {
          console.log("Starting JS scoring");
          //console.log(docs)
          const k = 10; // @Rank
          // k may be > length list, so count up the total number of documents processed.
          let count = 0, total = 0;
          eachDoc(function(doc, i) {
              if (hasDocRating(i) && (docRating(i)) > 0) { // map 0 -> irrel, 1+ ->rel
                  count = count + 1;
              }
              total = total + 1.0;
          }, k);
          const score = total ? count / total : 0.0;
          
         console.log("The score is " + score);
         setScore(score);
         // score;
         getScore()

        // } catch (error) {
        //   ({ error: error.message });
        // }

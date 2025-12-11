'use strict';

angular.module('QuepidApp')
  .controller('QueryMultiDiffResultsCtrl', [
    '$scope',
    'queriesSvc',
    function ($scope, queriesSvc) {
      var returnValue = [];

      function docSource() {
        return queriesSvc.showOnlyRated ? $scope.query.ratedDocs : $scope.query.docs;
      }

      var howManyToDisplay = docSource().length;
      if (howManyToDisplay < 10) {
        howManyToDisplay = 10;
      }

      // Initialize doc tuples for multi-diff comparison
      for (var j = 0; j < howManyToDisplay; j++) {
        returnValue[j] = { 
          doc: null, 
          diffDocs: []  // Array to hold docs from multiple snapshots
        };
      }

      $scope.query.maxMultiDiffDocScores = [];

      $scope.query.docTuples = function() {
        if (!$scope.query.multiDiff || !$scope.query.multiDiff.getSearchers) {
          return returnValue;
        }

        var allSearchers = $scope.query.multiDiff.getSearchers();
        
        // Initialize max scores array
        $scope.query.maxMultiDiffDocScores = [];
        for (var s = 0; s < allSearchers.length; s++) {
          $scope.query.maxMultiDiffDocScores[s] = 0;
        }

        for (var i = 0; i < howManyToDisplay; i++) {
          // Set current search result
          if (docSource()[i]) {
            returnValue[i].doc = docSource()[i];
          } else {
            returnValue[i].doc = null;
          }

          // Set diff docs from all searchers
          returnValue[i].diffDocs = [];
          
          for (var searcherIndex = 0; searcherIndex < allSearchers.length; searcherIndex++) {
            var diffDocs = $scope.query.multiDiff.docs(searcherIndex, queriesSvc.showOnlyRated);
            
            if (diffDocs[i]) {
              var diffDoc = diffDocs[i];
              $scope.query.maxMultiDiffDocScores[searcherIndex] = Math.max(
                $scope.query.maxMultiDiffDocScores[searcherIndex], 
                diffDoc.score()
              );
              returnValue[i].diffDocs[searcherIndex] = diffDoc;
            } else {
              returnValue[i].diffDocs[searcherIndex] = null;
            }
          }
        }
        
        return returnValue;
      };

      // Export functionality
      $scope.exportMultiDiffResults = function(format) {
        if (!$scope.query.multiDiff) {
          return;
        }

        var exportData = {
          query: $scope.query.query_text,
          timestamp: new Date().toISOString(),
          snapshots: $scope.query.multiDiff.names(),
          results: []
        };

        var docTuples = $scope.query.docTuples();
        
        angular.forEach(docTuples, function(tuple, index) {
          var resultRow = {
            position: index + 1,
            current: null,
            snapshots: []
          };

          // Current result
          if (tuple.doc) {
            resultRow.current = {
              id: tuple.doc.id,
              title: tuple.doc.title(),
              url: tuple.doc.url(),
              score: tuple.doc.score()
            };
          }

          // Snapshot results
          angular.forEach(tuple.diffDocs, function(diffDoc, snapIndex) {
            var snapshotResult = null;
            if (diffDoc) {
              snapshotResult = {
                id: diffDoc.id,
                title: diffDoc.title(),
                url: diffDoc.url(),
                score: diffDoc.score()
              };
            }
            resultRow.snapshots.push({
              name: exportData.snapshots[snapIndex],
              result: snapshotResult
            });
          });

          exportData.results.push(resultRow);
        });

        if (format === 'csv') {
          exportAsCsv(exportData);
        } else if (format === 'json') {
          exportAsJson(exportData);
        }
      };

      function exportAsCsv(data) {
        var csvContent = "Position,Current ID,Current Title,Current Score";
        
        // Add snapshot columns
        angular.forEach(data.snapshots, function(snapshotName) {
          csvContent += "," + snapshotName + " ID," + snapshotName + " Title," + snapshotName + " Score";
        });
        csvContent += "\n";

        // Add data rows
        angular.forEach(data.results, function(row) {
          var rowData = [
            row.position,
            row.current ? row.current.id : '',
            row.current ? '"' + row.current.title + '"' : '',
            row.current ? row.current.score : ''
          ];

          angular.forEach(row.snapshots, function(snapshot) {
            rowData.push(snapshot.result ? snapshot.result.id : '');
            rowData.push(snapshot.result ? '"' + snapshot.result.title + '"' : '');
            rowData.push(snapshot.result ? snapshot.result.score : '');
          });

          csvContent += rowData.join(',') + "\n";
        });

        downloadFile(csvContent, 'multi-diff-results.csv', 'text/csv');
      }

      function exportAsJson(data) {
        var jsonContent = JSON.stringify(data, null, 2);
        downloadFile(jsonContent, 'multi-diff-results.json', 'application/json');
      }

      function downloadFile(content, filename, contentType) {
        var blob = new Blob([content], { type: contentType });
        var url = window.URL.createObjectURL(blob);
        
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.URL.revokeObjectURL(url);
      }

      // Utility function to detect differences between results
      $scope.getResultDifference = function(currentDoc, diffDoc) {
        if (!currentDoc && !diffDoc) {
          return 'same';
        }
        if (!currentDoc && diffDoc) {
          return 'missing-current';
        }
        if (currentDoc && !diffDoc) {
          return 'missing-snapshot';
        }
        if (currentDoc.id === diffDoc.id) {
          return 'same';
        }
        return 'different';
      };

      // Add CSS classes based on differences
      $scope.getResultClass = function(difference) {
        switch (difference) {
          case 'different':
            return 'different';
          case 'missing-current':
            return 'missing';
          case 'missing-snapshot':
            return 'new';
          default:
            return '';
        }
      };
    }
  ]);
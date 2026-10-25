/**
 * Construction of a live Query object.
 *
 * The case service provides scoring/model adapters, while this
 * factory owns the stable query shape shared by bootstrapped and new queries.
 */
export function createLiveQueryFactory({
  getCaseNo,
  getShowOnlyRated,
  RatingsStore,
  onRatingChanged,
  createModel,
  getQueryState
}) {
  return {
    create(queryWithRatings) {
      const query = {
        hasBeenScored: false,
        docsSet: false,
        allRated: true,
        ratingsPromise: null,
        ratingsGeneration: 0,
        ratingsReady: false,
        queryId: queryWithRatings.queryId ?? queryWithRatings.query_id,
        caseNo: getCaseNo(),
        queryText: queryWithRatings.query_text,
        ratings: queryWithRatings.ratings || {},
        docs: [],
        ratedDocs: [],
        ratedDocsFound: 0,
        ratedDocsUnsupported: false,
        numFound: 0,
        options: queryWithRatings.options == null ? {} : queryWithRatings.options,
        notes: queryWithRatings.notes,
        modifiedAt: queryWithRatings.modified_at,
        informationNeed: queryWithRatings.information_need,
        ratingVariance: queryWithRatings.rating_variance,
        modified: queryWithRatings.updated_at,
        created: queryWithRatings.created_at,
        errorText: "",
        resultsReturned: false,
        defaultCaseOrder: 0,
        lastScore: 0,
        lastScoreVersion: -5
      }

      query.ratingsStore = new RatingsStore({
        caseNo: query.caseNo,
        queryId: query.queryId,
        ratingsDict: query.ratings,
        onChanged: onRatingChanged
      })

      query.browseUrl = () => (getShowOnlyRated() ? query.ratedUrl : query.linkUrl)

      Object.assign(
        query,
        createModel({
          query,
          ratingsStore: query.ratingsStore,
          getQueryState: () => getQueryState(query)
        })
      )

      return query
    }
  }
}

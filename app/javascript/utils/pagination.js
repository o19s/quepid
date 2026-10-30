/**
 * Page links for a bounded pagination control, as Legacy's dir-pagination-controls
 * (angular-utils-pagination 0.11) built them: at most `maxSize` entries, always the
 * first and last page, and an ellipsis (`null`) in place of the pages it skips.
 *
 * @param {number} currentPage 1-based
 * @param {number} pageCount
 * @param {number} [maxSize] number of entries, ellipses included; never fewer than 5
 * @returns {Array<number|null>}
 */
export function paginationRange(currentPage, pageCount, maxSize = 9) {
  const range = Math.max(maxSize, 5)
  const halfWay = Math.ceil(range / 2)
  const truncated = range < pageCount
  const atStart = currentPage <= halfWay
  const atEnd = !atStart && pageCount - halfWay < currentPage

  const pageAt = (position) => {
    if (position === range) return pageCount
    if (position === 1 || !truncated) return position
    if (atEnd) return pageCount - range + position
    if (!atStart) return currentPage - halfWay + position
    return position
  }

  const pages = []
  for (let position = 1; position <= Math.min(pageCount, range); position++) {
    const openingEllipsis = position === 2 && !atStart
    const closingEllipsis = position === range - 1 && !atEnd
    pages.push(truncated && (openingEllipsis || closingEllipsis) ? null : pageAt(position))
  }
  return pages
}

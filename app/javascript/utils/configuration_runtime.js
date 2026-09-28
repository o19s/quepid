export function createConfigurationRuntime() {
  let communalScorersOnly
  let queryListSortable
  let caseNo
  let tryNo

  return {
    setCommunalScorersOnly: (value) => {
      communalScorersOnly = JSON.parse(value)
    },
    isCommunalScorersOnly: () => communalScorersOnly,
    setQueryListSortable: (value) => {
      queryListSortable = JSON.parse(value)
    },
    isQueryListSortable: () => queryListSortable,
    setCaseNo: (value) => {
      caseNo = Number.parseInt(value, 10)
    },
    getCaseNo: () => caseNo,
    setTryNo: (value) => {
      tryNo = Number.parseInt(value, 10)
    },
    getTryNo: () => tryNo,
    reset: () => {
      communalScorersOnly = undefined
      queryListSortable = undefined
      caseNo = undefined
      tryNo = undefined
    }
  }
}

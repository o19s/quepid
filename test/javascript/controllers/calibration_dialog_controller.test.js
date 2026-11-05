import { afterEach, describe, expect, it, vi } from "vitest"
import CalibrationDialogController from "controllers/calibration_dialog_controller"

function buildController({ open = false } = {}) {
  document.body.innerHTML = `
    <div id="dialog">
      <select id="judge">
        <option value="">Choose</option>
        <option value="10" data-name="jev">jev</option>
        <option value="11" data-name="openai">openai</option>
      </select>
      <select id="reference">
        <option value="">Choose</option>
        <option value="5" data-name="Osc Team Member" data-eligible-pairs="178" data-complete-queries="17">Osc</option>
        <option value="11" data-name="openai" data-eligible-pairs="20" data-complete-queries="0">openai</option>
        <option value="7" data-name="Azure" data-eligible-pairs="40" data-complete-queries="3">Azure</option>
        <option value="8" data-name="Exact" data-eligible-pairs="30" data-complete-queries="0">Exact</option>
      </select>
      <div id="referenceHint"></div>
      <input id="unitQueries" type="radio" name="unit" value="queries">
      <input id="unitPairs" type="radio" name="unit" value="pairs" checked>
      <div id="unitHint" class="d-none"></div>
      <div id="queryRow"><input id="queryCount" type="number" value="20"><div id="queryHint"></div></div>
      <div id="sizeRow"><input id="sampleSize" type="number" value="50"><div id="sampleHint"></div></div>
      <input id="pairsNew" type="radio" name="pairs" value="new" checked>
      <input id="pairsSame" type="radio" name="pairs" value="same">
      <select id="sample" disabled>
        <option value="">Choose</option>
        <option value="3" data-reference-id="5" data-reference-name="Osc Team Member" data-size="60">60 pairs</option>
        <option value="4" data-reference-id="11" data-reference-name="openai" data-size="40">40 pairs</option>
      </select>
      <div id="problem" class="d-none"></div>
      <span id="summary"></span>
      <button id="submitButton" disabled>Start</button>
    </div>`
  const controller = Object.create(CalibrationDialogController.prototype)
  const el = id => document.getElementById(id)
  controller.element = el("dialog")
  controller.judgeTarget = el("judge")
  controller.referenceTarget = el("reference")
  controller.referenceHintTarget = el("referenceHint")
  controller.sampleSizeTarget = el("sampleSize")
  controller.sampleHintTarget = el("sampleHint")
  controller.unitQueriesTarget = el("unitQueries")
  controller.unitPairsTarget = el("unitPairs")
  controller.unitHintTarget = el("unitHint")
  controller.queryRowTarget = el("queryRow")
  controller.queryCountTarget = el("queryCount")
  controller.queryHintTarget = el("queryHint")
  controller.sizeRowTarget = el("sizeRow")
  controller.problemTarget = el("problem")
  controller.summaryTarget = el("summary")
  controller.pairsNewTarget = el("pairsNew")
  controller.pairsSameTarget = el("pairsSame")
  controller.sampleTarget = el("sample")
  controller.submitButtonTarget = el("submitButton")
  controller.hasPairsSameTarget = true
  controller.hasSampleTarget = true
  controller.minValue = 30
  controller.maxValue = 500
  controller.minQueriesValue = 10
  controller.maxQueriesValue = 50
  controller.openValue = open
  return controller
}

function choose(controller, target, value) {
  controller[`${target}Target`].value = value
  controller.update({ target: controller[`${target}Target`] })
}

describe("CalibrationDialogController", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    delete window.bootstrap
    vi.restoreAllMocks()
  })

  it("says nothing until both judges are chosen", () => {
    const controller = buildController()
    controller.connect()

    expect(controller.summaryTarget.textContent).toBe("")
    expect(controller.problemTarget.classList.contains("d-none")).toBe(true)
    expect(controller.sampleHintTarget.textContent).toBe("Between 30 and 500 pairs.")
  })

  it("states the reference's pairs and the number of calls once both are chosen", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "11")
    choose(controller, "reference", "5")

    expect(controller.referenceHintTarget.textContent).toBe("178 pairs rated by Osc Team Member on the book's scale.")
    expect(controller.sampleHintTarget.textContent).toBe("Between 30 and 178 pairs.")
    expect(controller.sampleSizeTarget.max).toBe("178")
    expect(controller.summaryTarget.textContent).toBe("This makes 50 calls to openai, compared against Osc Team Member.")
  })

  it("pulls the sample size down to what a new reference rated", () => {
    const controller = buildController()
    controller.connect()
    controller.sampleSizeTarget.value = "100"
    choose(controller, "judge", "10")
    choose(controller, "reference", "7")

    expect(controller.sampleSizeTarget.value).toBe("40")
    expect(controller.summaryTarget.textContent).toBe("This makes 40 calls to jev, compared against Azure.")
  })

  it("says exactly how many when the reference rated just the minimum", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "10")
    choose(controller, "reference", "8")

    expect(controller.sampleHintTarget.textContent).toBe("Exactly 30 pairs.")
    expect(controller.sampleSizeTarget.value).toBe("30")
    expect(controller.summaryTarget.textContent).toBe("This makes 30 calls to jev, compared against Exact.")
  })

  it("refuses calibrating a judge against itself", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "11")
    choose(controller, "reference", "11")

    expect(controller.problemTarget.textContent).toMatch(/can't be calibrated against itself/)
    expect(controller.problemTarget.classList.contains("d-none")).toBe(false)
    expect(controller.summaryTarget.textContent).toBe("")
  })

  it("refuses a reference with fewer pairs than the minimum", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "10")
    choose(controller, "reference", "11")

    expect(controller.problemTarget.textContent)
      .toBe("openai has rated only 20 pairs on this book's scale; a calibration needs at least 30.")
    expect(controller.sampleHintTarget.textContent).toBe("A calibration needs at least 30 pairs.")
  })

  it("refuses a sample size outside the range, without rewriting what is being typed", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "10")
    choose(controller, "reference", "5")
    choose(controller, "sampleSize", "5")

    expect(controller.sampleSizeTarget.value).toBe("5")
    expect(controller.problemTarget.textContent).toBe("Pick a sample size between 30 and 178.")
    expect(controller.summaryTarget.textContent).toBe("")
  })

  it("enables Start only once the choice can run", () => {
    const controller = buildController()
    controller.connect()
    expect(controller.submitButtonTarget.disabled).toBe(true)

    choose(controller, "judge", "11")
    expect(controller.submitButtonTarget.disabled).toBe(true)

    choose(controller, "reference", "5")
    expect(controller.submitButtonTarget.disabled).toBe(false)

    choose(controller, "sampleSize", "5")
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  it("reuses an earlier sample's pairs: its reference and size, with the new-sample fields disabled", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "10")
    controller.pairsSameTarget.checked = true
    controller.update({ target: controller.pairsSameTarget })

    expect(controller.referenceTarget.disabled).toBe(true)
    expect(controller.sampleSizeTarget.disabled).toBe(true)
    expect(controller.sampleTarget.disabled).toBe(false)
    expect(controller.submitButtonTarget.disabled).toBe(true)

    controller.referenceTarget.value = "7"
    choose(controller, "sample", "3")
    expect(controller.referenceTarget.value).toBe("5")
    expect(controller.referenceHintTarget.textContent)
      .toBe("These pairs were drawn from Osc Team Member's ratings, so Osc Team Member is the reference.")
    expect(controller.summaryTarget.textContent).toBe("This makes 60 calls to jev, compared against Osc Team Member.")
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("refuses reusing pairs whose reference is the judge being calibrated", () => {
    const controller = buildController()
    controller.connect()
    choose(controller, "judge", "11")
    controller.pairsSameTarget.checked = true
    choose(controller, "sample", "4")

    expect(controller.problemTarget.textContent).toMatch(/can't be calibrated against itself/)
    expect(controller.submitButtonTarget.disabled).toBe(true)
  })

  describe("sampling by queries", () => {
    function byQueries(controller) {
      controller.unitQueriesTarget.checked = true
      controller.unitPairsTarget.checked = false
      controller.update({ target: controller.unitQueriesTarget })
    }

    it("asks for a number of queries, up to the reference's whole top lists, and states the calls", () => {
      const controller = buildController()
      controller.connect()
      byQueries(controller)
      choose(controller, "judge", "10")
      choose(controller, "reference", "5")

      expect(controller.queryRowTarget.classList.contains("d-none")).toBe(false)
      expect(controller.sizeRowTarget.classList.contains("d-none")).toBe(true)
      expect(controller.queryCountTarget.value).toBe("17")
      expect(controller.queryHintTarget.textContent).toBe("Between 10 and 17 queries.")
      expect(controller.summaryTarget.textContent).toBe("This makes up to 170 calls to jev, compared against Osc Team Member.")
      expect(controller.submitButtonTarget.disabled).toBe(false)
    })

    it("falls back to pairs when the reference rated too few whole top lists", () => {
      const controller = buildController()
      controller.connect()
      byQueries(controller)
      choose(controller, "judge", "10")
      choose(controller, "reference", "7")

      expect(controller.unitQueriesTarget.disabled).toBe(true)
      expect(controller.unitPairsTarget.checked).toBe(true)
      expect(controller.unitHintTarget.textContent).toBe("Azure rated the whole top list of only 3 queries, so this samples pairs.")
      expect(controller.sizeRowTarget.classList.contains("d-none")).toBe(false)
    })

    it("refuses a number of queries outside the range", () => {
      const controller = buildController()
      controller.connect()
      byQueries(controller)
      choose(controller, "judge", "10")
      choose(controller, "reference", "5")
      choose(controller, "queryCount", "5")

      expect(controller.problemTarget.textContent).toBe("Pick between 10 and 17 queries.")
      expect(controller.submitButtonTarget.disabled).toBe(true)
    })
  })

  it("opens itself when asked to", () => {
    const show = vi.fn()
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn().mockReturnValue({ show }) } }
    const controller = buildController({ open: true })

    controller.connect()

    expect(window.bootstrap.Modal.getOrCreateInstance).toHaveBeenCalledWith(controller.element)
    expect(show).toHaveBeenCalled()
  })
})

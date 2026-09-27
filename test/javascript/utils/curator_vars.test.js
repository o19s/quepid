import { describe, expect, it } from "vitest"
import { extractCuratorVars } from "utils/curator_vars"

describe("extractCuratorVars", () => {
  it("extracts curator names while ignoring magic query and keyword placeholders", () => {
    const query = 'phrase=jobTitle:("#$keyword1## #$keyword2##" OR "#$keyword2## #$keyword3##")&keywords={!edismax qf="jobTitle^10 jobDesc" tie=1.0}#$query##&phraseScore=div(product(sum(##k##,1),query($phrase)),product(query($phrase),##k##))&phraseFunc=if(query($phrase),1.5,1)&q=_val_:"product($phraseFunc,1)"&fq={!edismax qf="jobTitle jobDesc"}#$query##'

    expect(extractCuratorVars(query)).toEqual(["k", "k"])
  })

  it("returns an empty list when no curator variables are present", () => {
    expect(extractCuratorVars("q=#$query##&keywords=#$keyword1##")).toEqual([])
  })
})

import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { pAll } from "utils/query_service"

// Property tests for the unthrottled path of pAll (requestsPerMinute unset).
// The rate-limited path sleeps between calls and is covered by example tests.
describe("pAll properties", () => {
  it("returns results in input order however completion is scheduled", async () => {
    await fc.assert(
      fc.asyncProperty(fc.scheduler(), fc.array(fc.integer(), { maxLength: 40 }), async (s, values) => {
        const queue = values.map((value) => () => s.schedule(Promise.resolve(value)))

        const done = pAll(queue)
        await s.waitAll()

        expect(await done).toEqual(values)
      })
    )
  })

  it("runs every task exactly once and never exceeds 10 in flight", async () => {
    await fc.assert(
      fc.asyncProperty(fc.scheduler(), fc.integer({ min: 0, max: 60 }), async (s, count) => {
        const calls = new Array(count).fill(0)
        let inFlight = 0
        let peak = 0
        const queue = calls.map((_, index) => async () => {
          calls[index] += 1
          inFlight += 1
          peak = Math.max(peak, inFlight)
          await s.schedule(Promise.resolve())
          inFlight -= 1
          return index
        })

        const done = pAll(queue)
        await s.waitAll()
        await done

        expect(calls.every((n) => n === 1)).toBe(true)
        expect(peak).toBeLessThanOrEqual(10)
      })
    )
  })

  it("lets every task finish, then rejects with the first failure to occur", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.scheduler(),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
        async (s, shouldFail) => {
          fc.pre(shouldFail.includes(true))
          let finished = 0
          let firstThrown
          const queue = shouldFail.map((fails, index) => async () => {
            await s.schedule(Promise.resolve())
            finished += 1
            if (fails) {
              const error = new Error(`task ${index}`)
              firstThrown ??= error
              throw error
            }
            return index
          })

          const done = pAll(queue)
          const outcome = done.then(
            () => null,
            (error) => error
          )
          await s.waitAll()
          const error = await outcome

          expect(finished).toBe(shouldFail.length)
          expect(error).toBe(firstThrown)
        }
      )
    )
  })
})

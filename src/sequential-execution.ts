import { Effect, Duration } from "effect"

// Helper function to simulate a task with a delay
const makeTask = (n: number, delay: Duration.DurationInput) =>
  Effect.promise(
    () =>
      new Promise<void>((resolve) => {
        console.log(`start task${n}`) // Logs when the task starts
        setTimeout(() => {
          console.log(`task${n} done`) // Logs when the task finishes
          resolve()
        }, Duration.toMillis(delay))
      })
  )

const task1 = makeTask(1, "200 millis")
const task2 = makeTask(2, "100 millis")

const sequential = Effect.all([task1, task2])

Effect.runPromise(sequential)
/*
Output:
start task1
task1 done
start task2 <-- task2 starts only after task1 completes
task2 done
*/
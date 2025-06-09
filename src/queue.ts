import { Effect, Queue } from "effect"

const program = Effect.gen(function* () {
  const queue = yield* Queue.bounded<number>(100)
  yield* Queue.offer(queue, 1)

  const value = yield* Queue.take(queue)
  return value
})

Effect.runPromise(program).then(console.log)

import { Effect, Queue, Fiber } from "effect"

const program = Effect.gen(function* () {

  const q = yield* Queue.bounded<string>(100)

  const fiber = yield* Effect.fork(Queue.take(q))

  yield* Queue.offer(q, "something")

  const value = yield* Fiber.join(fiber)

  return value
});

Effect.runPromise(program).then(console.log)
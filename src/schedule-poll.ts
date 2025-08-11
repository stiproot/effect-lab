import {
  Effect,
  Context,
  Console,
  Layer,
  Fiber,
  Queue,
  Duration,
  Schedule,
  Random
} from "effect";

interface IQSvc {
  readonly q: Queue.Queue<string>;
  readonly offer: (message: string) => Effect.Effect<void>;
  readonly take: () => Effect.Effect<string>;
}

class QSvc extends Context.Tag("QSvc")<QSvc, IQSvc>() { }

const QSvcLive = Layer.effect(
  QSvc,
  Effect.gen(function* () {
    const q = yield* Queue.unbounded<string>()
    yield* Console.log("Q is initialized")

    return {
      q: q,
      offer: (message: string) =>
        Effect.gen(function* () {
          yield* Queue.offer(q, message);
          yield* Console.log(`Offered message: "${message}"`);
        }),
      take: () =>
        Effect.gen(function* () {
          const message = yield* Queue.take(q);
          yield* Console.log(`Polled message: "${message}"`);
          return message;
        }),
    } as IQSvc
  })
)

const producerAction = Effect.gen(function* () {
  const { q } = yield* QSvc
  const rnd = yield* Random.next
  yield* Queue.offer(q, rnd.toString())
  yield* Console.log(`${rnd} added to the queue`)
})

const policy = Schedule.addDelay(Schedule.recurs(10), () => "5 seconds")

const producerProgram = Effect.repeat(producerAction, policy)

// Effect.runPromise(Effect.provide(producerProgram, QSvcLive)).then(console.log)

const consumerProgram = Effect.gen(function* () {
  const { q } = yield* QSvc;

  yield* Console.log("\n--- Starting message poller ---");

  yield* Effect.repeat(
    Effect.gen(function* () {
      const rslt = yield* Queue.take(q);
      yield* Console.log(`Consumed ${rslt}`)
    }),
    {
      until: () => Effect.succeed(false),
    }
  );
  yield* Console.log("--- Stopping message poller ---");
});


const program = Effect.gen(function* () {

  const consumerFiber = yield* Effect.fork(consumerProgram)

  yield* Effect.sleep(Duration.millis(100))

  // const producerFiber = yield* Effect.fork(producerProgram)
  yield* producerProgram

  yield* Fiber.interrupt(consumerFiber)

  yield* Console.log("Main program is finished.")
})

Effect.runPromise(Effect.provide(program, QSvcLive)).then(console.log)

import { Effect, Queue, Console, Schedule } from "effect"

const q = Queue.bounded<number>(100)

const action = Console.log("Hi there...")
const policy = Schedule.addDelay(Schedule.recurs(10), () => "5 seconds")

const program = Effect.repeat(action, policy)

Effect.runPromise(program).then((n) => console.log(`repetitions: ${n}`))
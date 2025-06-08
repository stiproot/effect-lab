import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Console, Random } from "effect"

class Sync extends Effect.Service<Sync>()("Sync", {
  sync: () => ({
    next: Random.nextInt
  })
}) { }

const syncProgram = Effect.gen(function* () {
  const sync = yield* Sync
  const n = yield* sync.next
  console.log(n)
})

Effect.runSync(syncProgram.pipe(Effect.provide(Sync.Default)))


class Scoped extends Effect.Service<Scoped>()("Scoped", {
  scoped: Effect.gen(function* () {
    const resource = yield* Effect.acquireRelease(
      Console.log("Aquiring").pipe(Effect.as("foo")),
      () => Console.log("releasing resource")
    )

    yield* Effect.addFinalizer(() => Console.log("Shutting down"))

    return { resource }
  })
}) { }

const scopedProgram = Effect.gen(function* () {
  const resource = (yield* Scoped).resource
  console.log(`The resource is ${resource}`)
})

Effect.runPromise(scopedProgram.pipe(Effect.provide(Scoped.Default)))

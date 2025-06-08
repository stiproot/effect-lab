import { FileSystem } from "@effect/platform"
import { NodeFileSystem } from "@effect/platform-node"
import { Effect, Console } from "effect"

export class Cache extends Effect.Service<Cache>()("app/Cache", {
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const lookup = (key: string) => fs.readFileString(`cache/${key}`)
    return { lookup } as const
  }),
  dependencies: [NodeFileSystem.layer],
  accessors: true
}) { }

const layer = Cache.Default
const layerNoDeps = Cache.DefaultWithoutDependencies

const program = Effect.gen(function* () {
  // const cache = yield* Cache
  // direct access when `accessors` enabled.
  const data = yield* Cache.lookup("my-key")
  console.log(data)
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)))

const runnable = program.pipe(Effect.provide(Cache.Default))

Effect.runFork(runnable)
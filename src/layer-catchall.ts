import { Config, Context, Effect, Layer } from "effect"

class HTTPServer extends Context.Tag("HTTPServer")<HTTPServer, void>() { }

const server = Layer.effect(
  HTTPServer,
  Effect.gen(function* () {
    const host = yield* Config.string("HOST")
    console.log(`Listening on http://localhost:${host}`)
  })
).pipe(
  // Recover from errors during layer construction
  Layer.catchAll((configError) =>
    Layer.effect(
      HTTPServer,
      Effect.gen(function* () {
        console.log(`Recovering from error:\n${configError}`)
        console.log(`Listening on http://localhost:3000`)
      })
    )
  )
)

Effect.runFork(Layer.launch(server))
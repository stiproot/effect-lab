import { Effect, Context, Layer, Config, ConfigError, Console } from "effect";
import "dotenv/config";

class Cfg extends Context.Tag("Config")<
  Cfg,
  {
    readonly getConfig: Effect.Effect<
      {
        readonly apiKey: string,
        readonly secretKey: string,
      }
    >
  }
>() { }

const CfgLive = Layer.succeed(
  Cfg,
  {
    getConfig: Effect.gen(function* () {
      const apiKey = yield* Config.string("ALPACA_API_KEY").pipe(
        Effect.catchTag("ConfigError", (error) =>
          Effect.dieMessage(`Failed to load configuration: ${error.message}`)
        ))

      const secretKey = yield* Config.string("ALPACA_SECRET_KEY").pipe(
        Effect.catchTag("ConfigError", (error) =>
          Effect.dieMessage(`Failed to load configuration: ${error.message}`)
        ))

      return {
        apiKey,
        secretKey,
      }
    })
  }
)
  .pipe(
    // Log a message if the layer acquisition succeeds
    Layer.tap((ctx) =>
      Console.log(`layer acquisition succeeded with:\n${ctx}`)
    ),
    // Log a message if the layer acquisition fails
    Layer.tapError((err) =>
      Console.log(`layer acquisition failed with:\n${err}`)
    )
  )

class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (msg: string) => Effect.Effect<void> }
>() { }

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {

    const config = yield* Cfg

    return {
      log: (msg: string) =>
        Effect.gen(function* () {

          const { apiKey, secretKey } = yield* config.getConfig

          console.log(msg)
          console.log(`(Alpaca API Key: ${apiKey}, Secret Key: ${secretKey})`)
        })
    }
  })
)

const program = Effect.gen(function* () {
  const logger = yield* Logger
  yield* logger.log('Using logger layer...')
  return logger
})

const runnable = Effect.provide(program, LoggerLive.pipe(Layer.provide(CfgLive)))

Effect.runPromise(runnable).then(console.log)

// Effect.runFork(Layer.launch(LoggerLive.pipe(Layer.provide(CfgLive))))

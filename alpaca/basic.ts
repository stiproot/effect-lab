import { Effect, Context, Layer, Console } from "effect";
import Alpaca from "@alpacahq/alpaca-trade-api";
import "dotenv/config";

class Config extends Context.Tag("Config")<
  Config,
  {
    readonly getConfig: Effect.Effect<{
      readonly alpacaApiKey: string,
      readonly alpacaSecretKey: string,
    }>
  }
>() { }

const ConfigLive = Layer.succeed(
  Config,
  Config.of({
    getConfig: Effect.succeed({
      alpacaApiKey: process.env.ALPACA_API_KEY!,
      alpacaSecretKey: process.env.ALPACA_SECRET_KEY!,
    }),
  })
)

class Logger extends Context.Tag("Logger")<
  Logger,
  { readonly log: (msg: string) => Effect.Effect<void> }
>() { }

const LoggerLive = Layer.effect(
  Logger,
  Effect.gen(function* () {
    const config = yield* Config
    return {
      log: (msg: string) =>
        Effect.gen(function* () {
          const { alpacaApiKey, alpacaSecretKey } = yield* config.getConfig
          console.log(msg)
          console.log(`(Alpaca API Key: ${alpacaApiKey}, Secret Key: ${alpacaSecretKey})`)
        })
    }
  })
)

class AlpacaClientFactory extends Context.Tag("AlpacaClient")<
  AlpacaClientFactory,
  { readonly createClient: () => Effect.Effect<Alpaca> }
>() { }

const AlpacaClientFactoryLive = Layer.effect(
  AlpacaClientFactory,
  Effect.gen(function* () {
    const config = yield* Config
    const logger = yield* Logger

    return {
      createClient: () =>
        Effect.gen(function* () {
          const { alpacaApiKey, alpacaSecretKey } = yield* config.getConfig
          yield* logger.log("creating client...")
          return new Alpaca({
            keyId: alpacaApiKey,
            secretKey: alpacaSecretKey,
            paper: true,
          })
        })
    }
  })
)

const AppConfigLive = Layer.merge(ConfigLive, LoggerLive);

const MainLive = AlpacaClientFactoryLive.pipe(
  Layer.provideMerge(AppConfigLive),
  Layer.provide(ConfigLive)
)

const program = Effect.gen(function* () {
  const factory = yield* AlpacaClientFactory;
  const logger = yield* Logger

  const client = yield* factory.createClient()

  yield* logger.log(`building client from program. Client type: ${typeof client}`)

  return client;
})

const runnable = Effect.provide(program, MainLive)

Effect.runPromise(runnable).then(() => console.log('done!'))
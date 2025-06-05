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
          console.log(`Alpaca API Key: ${alpacaApiKey}, Secret Key: ${alpacaSecretKey}`);
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
          yield* logger.log("hey")
          const { alpacaApiKey, alpacaSecretKey } = yield* config.getConfig

          return new Alpaca({
            keyId: alpacaApiKey,
            secretKey: alpacaSecretKey,
            paper: true,
          })
        })
    }
  })
)



import { Effect, Context, Layer, Config, } from "effect";
import "dotenv/config";

class Database extends Context.Tag("Database")<Database, void>() { }

const postgresDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    const databaseConnectionString = yield* Config.string(
      "CONNECTION_STRING"
    )
    console.log(
      `Connecting to database with: ${databaseConnectionString}`
    )
  })
)

const inMemoryDatabaseLayer = Layer.effect(
  Database,
  Effect.gen(function* () {
    console.log(`Connecting to in-memory database`)
  })
)

const database = postgresDatabaseLayer.pipe(
  Layer.orElse(() => inMemoryDatabaseLayer)
)

Effect.runFork(Layer.launch(database))
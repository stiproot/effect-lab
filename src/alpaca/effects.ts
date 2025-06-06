import * as Effect from "effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Console from "effect/Console";
import Alpaca from "@alpacahq/alpaca-trade-api";
import "dotenv/config"; // Loads .env file immediately

// 1. Define the Alpaca Client as an Effect Service
//    This creates a "tag" that we can use to refer to our Alpaca client service.
export class AlpacaClientService extends Context.Tag("AlpacaClientService")<
  AlpacaClientService,
  Alpaca
>() { }

// 2. Create a Layer that provides the AlpacaClientService
//    A Layer describes how to construct a service.
export const AlpacaClientLive = Layer.succeed(
  AlpacaClientService,
  Effect.sync(() => {
    // Ensure API keys are loaded from .env
    const keyId = process.env.ALPACA_API_KEY_ID;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (!keyId || !secretKey) {
      throw new Error(
        "Alpaca API Key ID and Secret Key must be set in .env"
      );
    }

    return new Alpaca({
      keyId: keyId,
      secretKey: secretKey,
      paper: true, // IMPORTANT: Set to true for paper trading, false for live
    });
  })
);

// 3. Refactor the getLatestQuote call into an Effect
//    This function now returns an Effect that requires AlpacaClientService
//    and can potentially fail with an Error.
const getLatestQuoteEffect = (symbol: string) =>
  Effect.gen(function* ($) {
    const alpacaClient = yield* $(AlpacaClientService); // Get the client from the context

    yield* $(Console.log(`Fetching latest quote for ${symbol}...`));

    const quote = yield* $(
      Effect.tryPromise({
        // Wrap the promise-based call in Effect.tryPromise
        try: () => alpacaClient.getLatestQuote(symbol),
        catch: (error) => new Error(`Failed to get quote for ${symbol}: ${error}`),
      })
    );

    yield* $(Console.log(`Latest bid price for ${symbol}: $${quote.bidprice}`));
    yield* $(Console.log(`Latest ask price for ${symbol}: $${quote.askprice}`));
    yield* $(Console.log(`Mid price for ${symbol}: $${(quote.bidprice + quote.askprice) / 2}`));

    return quote;
  });

// 4. Refactor the buyNVIDIAGetQuoteAndOrder function to use Effect
const buyNVIDIAGetQuoteAndOrderEffect = (quantity: number = 1) =>
  Effect.gen(function* ($) {
    const symbol = "NVDA";

    // Call the Effect-wrapped getLatestQuote
    const quote = yield* $(getLatestQuoteEffect(symbol));

    // For demonstration, we'll just log the quote and return.
    // In a real scenario, you'd continue with market open check and placing the order,
    // all within the Effect flow.
    yield* $(Console.log("Quote retrieved successfully:", quote));

    // This is where you would continue with the market open check and order placement
    // Also using Effect for those operations.
    // Example (simplified):
    // const clock = yield* $(
    //   Effect.tryPromise({
    //     try: () => (yield* $(AlpacaClientService)).getClock(),
    //     catch: (e) => new Error(`Failed to get clock: ${e}`),
    //   })
    // );
    // yield* $(Console.log("Market open:", clock.is_open));

    // const order = yield* $(
    //   Effect.tryPromise({
    //     try: () => (yield* $(AlpacaClientService)).createOrder({
    //       symbol: symbol,
    //       qty: quantity,
    //       side: 'buy',
    //       type: 'market',
    //       time_in_force: 'day',
    //     }),
    //     catch: (e) => new Error(`Failed to place order: ${e}`),
    //   })
    // );
    // yield* $(Console.log("Order submitted successfully:", order));

    return `Successfully processed quote for ${symbol}`;
  });

// 5. Run the Effect program
const program = buyNVIDIAGetQuoteAndOrderEffect(2).pipe(
  Effect.provide(AlpacaClientLive), // Provide the AlpacaClientService
  Effect.tapError((e) => Console.error(`Program failed: ${e.message}`)), // Log errors
  Effect.runPromise // Run the Effect
);

// Execute the program
program;
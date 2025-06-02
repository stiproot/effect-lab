
import { Effect, Console } from "effect";

const program = Console.log("Hello, Effect!");

Effect.runSync(program);

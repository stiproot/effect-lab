# Effectful

1. “Effectful” in plain English

When I say something is effectful, I mean:

It does something beyond just returning a value — it performs side effects (like I/O, mutation, time, randomness) — but it does so in a controlled, pure, and composable way.

In JavaScript terms:

A pure function is predictable:

const add = (a: number, b: number) => a + b

Same input → same output.

No hidden state changes.

An effectful function has side effects:

const logAndAdd = (a: number, b: number) => {
  console.log("adding", a, b)   // side effect
  return a + b
}

In normal JS, you just do the side effect — there’s no structure around it.
In Effect-TS, you model that side effect as a value (Effect), not execute it directly.

💡 2. “Effect” as a value representing a computation

In Effect-TS, Effect<A> (actually Effect<R, E, A>) is a description of a computation, not the computation itself.

For example:

import { Effect } from "effect"

const program = Effect.sync(() => console.log("hello"))


Here:

program is a value describing “print hello”.

Nothing runs yet — it’s just data.

Only when you call Effect.runSync(program) does it actually execute the side effect.

So we can say program is an effectful computation.

⚙️ 3. Why is this powerful?

Because by wrapping effects inside Effect, you gain control and composability:

Purity: You can still treat the description as a pure value (referential transparency).

Composability: You can combine, sequence, or retry effects (Effect.all, Effect.retry, etc.).

Safety: You can catch failures (Effect.catchAll).

Concurrency: You can run effects in parallel safely.

🧱 4. Example: “effectful Ref operations”

Every Ref operation returns an Effect, not a raw value — because reading/updating a shared reference is a side effect.

Compare:

✅ Pure function
const inc = (n: number) => n + 1


No external state.

⚙️ Effectful Ref operation
import { Ref, Effect } from "effect"

const program = Effect.gen(function*($) {
  const ref = yield* $(Ref.make(0))
  yield* $(Ref.update(ref, n => n + 1)) // <- effectful mutation
  const value = yield* $(Ref.get(ref))
  return value
})


Here:

Ref.make is effectful because it creates mutable state.

Ref.update is effectful because it mutates shared state atomically.

Ref.get is effectful because it reads a potentially changing value.

Each of these returns an Effect, so you use yield* $(...) (or Effect.flatMap) to sequence them inside another effect.

🧩 5. The formal type of an Effect

An Effect<R, E, A> means:

Type Parameter	Meaning
R	The required environment (dependencies)
E	The possible error type
A	The success type

So for example:

Effect<never, never, number> → returns a number, no env, no error (pure).

Effect<never, Error, string> → might fail with an Error.

Effect<Database, never, User> → needs a Database dependency.

🧠 6. Why not just run the side effect directly?

Because by keeping side effects deferred, Effect-TS can:

Schedule and parallelize them safely,

Cancel or retry them,

Ensure resource safety (Effect.acquireRelease),

Test them deterministically,

Provide structured concurrency (fibers, supervision, etc.).

That’s the essence of structured, effectful programming.

🧭 TL;DR Summary
Concept	Description
Effectful	Performs side effects (I/O, mutation, time, etc.), wrapped in an Effect.
Pure	Has no side effects, always returns same output for same input.
Why model effects?	For composability, testability, safety, and concurrency control.
Example	Ref.update(ref, f) returns an Effect<void>, not void.
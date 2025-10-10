# Refs

  1. What is Ref (conceptually)

    A Ref<A> is a concurrent, effectful, mutable reference holding a value of type A.
    You create one inside the Effect runtime and then read or update it with effectful operations (each operation returns an Effect).
    It gives you a controlled, type-safe way to share mutable state across fibers.

    Important idea: operations on a Ref are atomic from the user’s perspective (e.g. modify performs a read/compute/compare-and-set loop internally so concurrent updates are safe).
    That is how Ref provides lock-free concurrency semantics (compare-and-swap style).
    +1

  2. When to use Ref

    Use Ref when you need a small piece of shared, mutable state that many fibers may read or update (counters, small caches, last-seen value, etc.).

    Don’t use Ref for complex synchronization (e.g. waiting for a value once) — use Deferred for that.
    For queues/producer-consumer patterns prefer Queue. Use fiber-local FiberRef when you want per-fiber local mutable state propagated by the runtime. 

  3. Creation & safety

    Ref.make(value) returns an Effect that, when run, yields a Ref<A> (i.e. Effect<Ref<A>>). There is also unsafeMake that constructs a Ref synchronously (unsafe because it breaks the effectful creation discipline). 

    You run the effect that creates / uses the Ref with the runtime (e.g. Effect.runPromise or Effect.runSync depending on whether it’s async). Effect.gen is useful to write imperative-looking effectful code while staying in the effect system. 

  4. Core API (what you’ll actually call)

    (Using the canonical names from the API docs — these are all effectful operations returning Effect values.)

    Ref.make<A>(value: A): Effect<Ref<A>> — create a Ref. 

    Ref.unsafeMake<A>(value: A): Ref<A> — synchronous/unsafe creation. 

    Ref.get(ref) → Effect<A> — read the value. 

    Ref.set(ref, value) → Effect<void> — set to new value. 

    Ref.getAndSet(ref, value) → Effect<A> — set and return previous value. 

    Ref.update(ref, f) → Effect<void> — apply pure update f: A => A. 

    Ref.updateAndGet(ref, f) → Effect<A> — update and return new value. getAndUpdate exists too. 

    Ref.modify(ref, f) → Effect<B> where f: A => readonly [B, A] — atomically read current A, compute B and new A, set the new A, and return B. This is the primitive for many atomic patterns; implement compare-and-swap loops under the hood. Use this to implement read-modify-return semantics. 

    Ref.getAndUpdateSome, Ref.modifySome, etc. — conditional/partial updates that only change the ref if a predicate / partial function applies. Useful to avoid always computing new state. 

    (See the API reference for the full list and signatures.) 

  5. Implementation note (atomicity / CAS loop)

    Internally modify is typically implemented as a compare-and-swap loop: read current value, compute new value, attempt an atomic CAS; if CAS fails because another fiber updated in the meantime, retry (spin).
    From the user perspective this makes modify atomic and lock-free. This pattern is standard in functional effect systems and is how Ref provides safe concurrent updates without explicit locks. (This is the same general approach used by other FP runtimes — cats-effect, zio, etc.)

  6. Ref vs FiberRef vs Deferred vs Queue

    Ref — a single shared, atomic reference (global to all fibers that have access). Good for shared state.

    FiberRef — fiber-local storage: each fiber has its own value that can be inherited/isolated when forking. Use it for per-request context etc. (not for inter-fiber communication). 
    effect.website

    Deferred — one-time set + wait primitive (like a typed Promise) used for synchronization and waiting for a result. 
    effect.website

    Queue — for producer/consumer flows, backpressure, buffering, etc.

  7. Practical examples

    Minimal example (create, update, get):

    import { Effect, Ref } from "effect"

    const program = Effect.gen(function* ($) {
      const ref = yield* $(Ref.make(0))        // Effect<Ref<number>>
      yield* $(Ref.update(ref, (n) => n + 1))  // increment
      const value = yield* $(Ref.get(ref))     // read
      return value
    })

    Effect.runPromise(program).then((v) => console.log("value:", v)) // -> value: 1


    Using modify to atomically read-and-return-old:

    const program2 = Effect.gen(function* ($) {
      const ref = yield* $(Ref.make(10))
      // atomically return previous value and increment
      const prev = yield* $(Ref.modify(ref, (n) => [n, n + 1]))
      return prev // 10
    })


    A conditional update (only update if predicate holds):

    // getAndUpdateSome / modifySome combinators let you do conditional updates


    (See Ref API for getAndUpdateSome / modifySome signatures.) 
    effect-ts.github.io

8) Common pitfalls & best practices

Avoid mutating the object stored inside a Ref in place. Ref guarantees atomic reference changes to the value — if the value is an object and you mutate it in place, other fibers may observe mutated state unexpectedly. Prefer immutable updates (return a new object).

Prefer modify for read–compute–write semantics. If you need the old value or want to compute a result as part of the update, modify is the atomic primitive.

Be careful with large/complex state. Ref is great for small pieces of state. For big, complex concurrent state machines you might prefer higher-level structures (Queues, STM if available, or a dedicated actor/service).

Testing: because operations are effects, tests should run your effects in the runtime (Effect.runPromise/runSyncExit or with test helpers). Use Effect.gen to reason about sequences. 
effect-ts.github.io
+1

9) Performance considerations

Ref updates are lock-free and typically cheap (CAS loop). If contention is extremely high and you have lots of short updates, contention may cost retries — consider structure (sharded refs, counters per shard, or a Queue/actor) to reduce contention. The usual tradeoffs from lock-free algorithms apply. (CAS retries are the expected cost under contention.) 
Wikipedia

10) Small design recipes (patterns)

Counters: Ref<number> + updateAndGet or modify for atomic increment-and-read.

Optional cache with compare-and-set: read the ref; if empty compute value, modify to set it and return the cached value — modify avoids races.

State machine: use modify to transition current state to a new state and return an outcome (no locks needed).

Actor-like single-writer: use a Ref to hold state and Queue for incoming commands processed serially by a single fiber (helps with contention and complex transitions).

11) Where to read next (official docs / API)

Ref overview (state management) — docs and conceptual discussion. 
effect.website

Concrete Ref API with signatures: Ref.ts page in the API docs (make/get/modify/update/etc.). 
effect-ts.github.io

Fiber / FiberRef docs (for when you consider fiber-local state). 
effect.website

Deferred docs (synchronisation complement to Ref). 
effect.website

If you want, I can:

Walk through converting a specific shared-state problem you have into a Ref-based solution and show the complete effectful program (tests + run).

Produce a short checklist of “use Ref when … / use Deferred when … / use Queue when …” tailored to your app.

Which would you like next?

You said:
What do you mean by "effectful"?
ChatGPT said:

Excellent question — the word “effectful” is one of those core ideas in functional programming that you must internalize to really understand libraries like Effect (Effect-TS), ZIO, Cats Effect, etc.

Let’s unpack it clearly and practically.

🚦 1. “Effectful” in plain English

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
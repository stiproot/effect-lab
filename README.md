# effect-lab
Personal laboratory for experimenting with Effect TS

# Concepts
The Effect type is an immutable description of a workflow or operation that is lazily executed. 
This means that when you create an Effect, it doesn’t run immediately, but instead defines a program that can succeed, fail, or require some additional context to complete.

## Form of Effect
         ┌─── Represents the success type
         │        ┌─── Represents the error type
         │        │      ┌─── Represents required dependencies
         ▼        ▼      ▼
Effect<Success, Error, Requirements>

This type indicates that an effect:
- Succeeds and returns a value of type Success
- Fails with an error of type Error
- May need certain contextual dependencies of type Requirements to execute

Conceptually, you can think of Effect as an effectful version of the following function type:

```ts
type Effect<Success, Error, Requirements> = (
  context: Context<Requirements>
) => Error | Success
```

**However, effects are not actually functions.**
They can model synchronous, asynchronous, concurrent, and resourceful computations.

**Immutability**
  - Effect values are immutable, and every function in the Effect library produces a new Effect value.
**Modeling Interactions**
  - These values do not perform any actions themselves, they simply model or describe effectful interactions.
**Execution**
  - An Effect can be executed by the Effect Runtime System, which interprets it into actual interactions with the external world. 
  - Ideally, this execution happens at a single entry point in your application, such as the main function where effectful operations are initiated.

## Type Parameters
The Effect type has three type parameters with the following meanings:

**Success**
Represents the type of value that an effect can succeed with when executed. 
If this type parameter is `void`, it means the effect produces no useful information, while if it is `never`, it means the effect runs forever (or until failure).

**Error**
Represents the expected errors that can occur when executing an effect.
If this type parameter is `never`, it means the effect cannot fail, because there are no values of type `never`.

**Requirements**
Represents the contextual data required by the effect to be executed. This data is stored in a collection named Context. 
If this type parameter is never, it means the effect has no requirements and the Context collection is empty.

## Type Parameter Abbreviations
In the Effect ecosystem, you may often encounter the type parameters of Effect abbreviated as A, E, and R respectively. 
This is just shorthand for the success value of type A, Error, and Requirements.

## Extracting Inferred Types
By using the utility types `Effect.Success`, `Effect.Error`, and `Effect.Context`, you can extract the corresponding types from an effect.

Example (Extracting Success, Error, and Context Types)

```ts
import { Effect, Context } from "effect"

class SomeContext extends Context.Tag("SomeContext")<SomeContext, {}>() {}

// Assume we have an effect that succeeds with a number,
// fails with an Error, and requires SomeContext
declare const program: Effect.Effect<number, Error, SomeContext>

// Extract the success type, which is number
type A = Effect.Effect.Success<typeof program>

// Extract the error type, which is Error
type E = Effect.Effect.Error<typeof program>

// Extract the context type, which is SomeContext
type R = Effect.Effect.Context<typeof program>
```

### Additional Information / Deep Dive:
1. In the effect library, `Context` is a system for dependency injection.
  - `Context.Tag(name)` creates a unique tag for identifying a service in the context system.
  - The tag acts like a symbol or key for registering and retrieving implementations.
  - `Context.Tag("SomeContext")` returns a constructor or base type that you extend. (It's effectively saying: "I'm creating a context handle for SomeContext services")

2. `<SomeContext, {}>`
  - First type (SomeContext) → the service type the tag represents.
  - Second type ({}) → the interface or contract (often an empty object, meaning no additional requirements).
  - So here, we’re saying: “This tag represents the SomeContext service, which implements {}.”

3. Why () {} on the class?
This syntax: 
```ts
class SomeContext extends Something() {}
```
is shorthand for for extending a dynamically generated class.
It is dynamic inheritance -> you extend a class produced at runtime, not a statically written base class.
Referred to a a curried constructor function.



## Creating Effects

- `Effect.succeed(value)` - Creates an effect that succeeds with the given value.
```txt
         ┌─── Produces a value of type number
         │       ┌─── Does not generate any errors
         │       │      ┌─── Requires no dependencies
         ▼       ▼      ▼
Effect<number, never, never>
```

- `Effect.fail(error)` - Creates an effect that fails with the given error.

### Tagged Error
Using “tagged” errors (objects with a _tag field) can help identify error types and works well with standard Effect functions, like Effect.catchTag.

```ts
import { Effect, Data } from "effect"

class HttpError extends Data.TaggedError("HttpError")<{}> {}

//      ┌─── Effect<never, HttpError, never>
//      ▼
const program = Effect.fail(new HttpError())
```

## Error Tracking

```ts
import { Effect } from "effect"

const divide = (a: number, b: number): Effect.Effect<number, Error> => 
    b === 0
        ? Effect.fail(new Error("Division by zero"))
        : Effect.succeed(a / b)
```

### Modeling Synchronous Effects
A “thunk” is a function that takes no arguments and may return some value.
Thunks are useful for delaying the computation of a value until it is needed.
To model synchronous side effects, Effect provides the `Effect.sync` and `Effect.try` constructors, which accept a thunk.

**sync**
Creates an Effect that represents a synchronous side-effectful computation.
Use Effect.sync when you are sure the operation will not fail.

The provided function (thunk) must not throw errors; if it does, the error will be treated as a “defect”.

```ts
import { Effect } from "effect"

const log = (message: string) =>
  Effect.sync(() => {
    console.log(message) // side effect
  })

//      ┌─── Effect<void, never, never>
//      ▼
const program = log("Hello, World!")
```

**try**
Creates an Effect that represents a synchronous computation that might fail.
```ts
import { Effect } from "effect"

const parse = (input: string) =>
  // This might throw an error if input is not valid JSON
  Effect.try(() => JSON.parse(input))

//      ┌─── Effect<any, UnknownException, never>
//      ▼
const program = parse("")
```

Effect.try supports an overload that allows you to specify how caught exceptions should be transformed:
```ts
import { Effect } from "effect"

const parse = (input: string) =>
  Effect.try({
    // JSON.parse may throw for bad input
    try: () => JSON.parse(input),
    // remap the error
    catch: (unknown) => new Error(`something went wrong ${unknown}`)
  })

//      ┌─── Effect<any, Error, never>
//      ▼
const program = parse("")
```

### Modeling Asynchronous Effects

**promise**
Creates an Effect that represents an asynchronous computation guaranteed to succeed.
The provided function (thunk) returns a Promise that should never reject; if it does, the error will be treated as a “defect”.

```ts
import { Effect } from "effect"

const delay = (message: string) =>
  Effect.promise<string>(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(message)
        }, 2000)
      })
  )

//      ┌─── Effect<string, never, never>
//      ▼
const program = delay("Async operation completed successfully!")
```

**tryPromise**
Creates an Effect that represents an asynchronous computation that might fail.

```ts
import { Effect } from "effect"

const getTodo = (id: number) =>
  // Will catch any errors and propagate them as UnknownException
  Effect.tryPromise(() =>
    fetch(`https://jsonplaceholder.typicode.com/todos/${id}`)
  )

//      ┌─── Effect<Response, UnknownException, never>
//      ▼
const program = getTodo(1)
```

If you want more control over what gets propagated to the error channel, you can use an overload of Effect.tryPromise that takes a remapping function:
```ts
import { Effect } from "effect"

const getTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    // remap the error
    catch: (unknown) => new Error(`something went wrong ${unknown}`)
  })

//      ┌─── Effect<Response, Error, never>
//      ▼
const program = getTodo(1)

```

**async**
Creates an Effect from a callback-based asynchronous function.

Sometimes you have to work with APIs that don’t support async/await or Promise and instead use the callback style.
To handle callback-based APIs, Effect provides the Effect.async constructor.

```ts
import { Effect } from "effect"
import * as NodeFS from "node:fs"

const readFile = (filename: string) =>
  Effect.async<Buffer, Error>((resume) => {
    NodeFS.readFile(filename, (error, data) => {
      if (error) {
        // Resume with a failed Effect if an error occurs
        resume(Effect.fail(error))
      } else {
        // Resume with a succeeded Effect if successful
        resume(Effect.succeed(data))
      }
    })
  })

//      ┌─── Effect<Buffer, Error, never>
//      ▼
const program = readFile("example.txt")
```

**Advanced Usage**
For more advanced use cases, resume can optionally return an Effect that will be executed if the fiber running this effect is interrupted. 
This can be useful in scenarios where you need to handle resource cleanup if the operation is interrupted.

```ts
import { Effect, Fiber } from "effect"
import * as NodeFS from "node:fs"

// Simulates a long-running operation to write to a file
const writeFileWithCleanup = (filename: string, data: string) =>
  Effect.async<void, Error>((resume) => {
    const writeStream = NodeFS.createWriteStream(filename)

    // Start writing data to the file
    writeStream.write(data)

    // When the stream is finished, resume with success
    writeStream.on("finish", () => resume(Effect.void))

    // In case of an error during writing, resume with failure
    writeStream.on("error", (err) => resume(Effect.fail(err)))

    // Handle interruption by returning a cleanup effect
    return Effect.sync(() => {
      console.log(`Cleaning up ${filename}`)
      NodeFS.unlinkSync(filename)
    })
  })

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(
    writeFileWithCleanup("example.txt", "Some long data...")
  )
  // Simulate interrupting the fiber after 1 second
  yield* Effect.sleep("1 second")
  yield* Fiber.interrupt(fiber) // This will trigger the cleanup
})

// Run the program
Effect.runPromise(program)
/*
Output:
Cleaning up example.txt
*/
```

If the operation you’re wrapping supports interruption, the resume function can receive an AbortSignal to handle interruption requests directly.
```ts
import { Effect, Fiber } from "effect"

// A task that supports interruption using AbortSignal
const interruptibleTask = Effect.async<void, Error>((resume, signal) => {
  // Handle interruption
  signal.addEventListener("abort", () => {
    console.log("Abort signal received")
    clearTimeout(timeoutId)
  })

  // Simulate a long-running task
  const timeoutId = setTimeout(() => {
    console.log("Operation completed")
    resume(Effect.void)
  }, 2000)
})

const program = Effect.gen(function* () {
  const fiber = yield* Effect.fork(interruptibleTask)
  // Simulate interrupting the fiber after 1 second
  yield* Effect.sleep("1 second")
  yield* Fiber.interrupt(fiber)
})

// Run the program
Effect.runPromise(program)
/*
Output:
Abort signal received
*/
```

The `Generator<TYield, TReturn, TNext>` type is often used for this:
- TYield: The type of values yielded.
- TReturn: The type of the value returned when the generator completes (via return or reaching the end).
- TNext: The type of the argument passed to next().

```ts
function* fibonacci(): Generator<number, void, boolean> {
  let a = 0;
  let b = 1;
  while (true) {
    const reset = yield a; // 'reset' will be of type boolean (from TNext)
    if (reset) {
      a = 0;
      b = 1;
    } else {
      [a, b] = [b, a + b];
    }
  }
}

const fibGen = fibonacci();
console.log(fibGen.next());      // { value: 0, done: false }
console.log(fibGen.next());      // { value: 1, done: false }
console.log(fibGen.next(true));  // { value: 0, done: false } (resets due to `true`)
console.log(fibGen.next());      // { value: 1, done: false }
```

Key characteristics of yield*:
- Delegates iteration: It essentially "flattens" the iteration of nested iterables.
- Forwards next(), return(), and throw(): The yield* operator forwards calls to next(), return(), and throw() methods from the outer generator to the inner delegated iterator.
- Returns the delegated iterator's return value: When the delegated iterator finishes (its done property becomes true), the value property of its final IteratorResult is returned by the yield* expression in the delegating generator. This is a crucial distinction from yield, which only yields the value.

```ts
function* generateNumbers(): Generator<number> {
  yield 1;
  yield 2;
}

function* generateLetters(): Generator<string> {
  yield 'a';
  yield 'b';
}

function* combinedGenerator(): Generator<number | string, string, undefined> {
  yield 0;
  yield* generateNumbers(); // Delegates to generateNumbers()
  yield 'c';
  const message = yield* generateLetters(); // Delegates to generateLetters(), message will be 'b' if letters returns a value
  console.log("Returned from letters generator:", message); // This line will execute after generateLetters finishes
  yield 3;
  return "All done!"; // This is the final return value of combinedGenerator
}

const combinedGen = combinedGenerator();

console.log(combinedGen.next()); // { value: 0, done: false }
console.log(combinedGen.next()); // { value: 1, done: false } (from generateNumbers)
console.log(combinedGen.next()); // { value: 2, done: false } (from generateNumbers)
console.log(combinedGen.next()); // { value: 'c', done: false }
console.log(combinedGen.next()); // { value: 'a', done: false } (from generateLetters)
console.log(combinedGen.next()); // { value: 'b', done: false } (from generateLetters)
// At this point, 'generateLetters' is done. The 'yield*' expression resolves to 'b' (the last yielded value) and 'console.log' runs.
console.log(combinedGen.next()); // { value: 3, done: false }
console.log(combinedGen.next()); // { value: 'All done!', done: true }
```

---


# Resources
- [CONCEPTS.md](CONCEPTS.md) - Detailed explanation of TS concepts

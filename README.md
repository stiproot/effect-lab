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

Said another way:
```ts
class Random extends Context.Tag("MyRandomService")<
  Random,
  {
    readonly next: Effect.Effect<number>
  }
>() {}
```
is something akin to:
```ts
class MyClass<T> {
  // ...
}
class AnotherClass extends MyClass<AnotherClass> {
  // Here, MyClass is parameterized with AnotherClass,
  // but AnotherClass isn't structurally self-referential
}
```

---

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

---

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

---

## Suspended Effects

`Effect.suspend` is used to delay the creation of an effect. 
It allows you to defer the evaluation of an effect until it is actually needed. 
The `Effect.suspend` function takes a thunk that represents the effect, and it wraps it in a suspended effect.

```ts
const suspendedEffect = Effect.suspend(() => effect)
```

## Lazy Evaluation
When you want to defer the evaluation of an effect until it is required. 
This can be useful for optimizing the execution of effects, especially when they are not always needed or when their computation is expensive.

Also, when effects with side effects or scoped captures are created, use Effect.suspend to re-execute on each invocation.

```ts
import { Effect } from "effect"

let i = 0

const bad = Effect.succeed(i++)
const good = Effect.suspend(() => Effect.succeed(i++))

console.log(Effect.runSync(bad)) // Output: 0
console.log(Effect.runSync(bad)) // Output: 0

console.log(Effect.runSync(good)) // Output: 1
console.log(Effect.runSync(good)) // Output: 2
```

---

# Requirements Management
A `service` refers to a reusable component or functionality that can be used by different parts of an application.
Services are designed to provide specific capabilities and can be shared across multiple modules or components.

*Example (Defining a Random Number Generator Service)*

Let’s create a service for generating random numbers.
- Identifier. We’ll use the string "MyRandomService" as the unique identifier.
- Type. The service type will have a single operation called next that returns a random number.

```ts
import { Effect, Context } from "effect"

// Declaring a tag for a service that generates random numbers
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Effect.Effect<number> }
>() {}
```

The exported Random value is known as a tag in Effect. 
It acts as a representation of the service and allows Effect to locate and use this service at runtime.

The service will be stored in a collection called Context, which can be thought of as a Map where the keys are tags and the values are services:

```ts
type Context = Map<Tag, Service>
```

**Using the service:**

```ts
import { Effect, Context } from "effect"

// Declaring a tag for a service that generates random numbers
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Effect.Effect<number> }
>() {}

// Using the service
//
//      ┌─── Effect<void, never, Random>
//      ▼
const program = Effect.gen(function* () {
  const random = yield* Random
  const randomNumber = yield* random.next
  console.log(`random number: ${randomNumber}`)
})

// The following will result in a type-checking error... as there is not implementation provided...
Effect.runSync(program)

// Error ts(2379) ― Argument of type 'Effect<void, never, Random>' is not assignable to parameter of type 'Effect<void, never, never>' with 'exactOptionalPropertyTypes: true'. 
// Consider adding 'undefined' to the types of the target's properties. Type 'Random' is not assignable to type 'never'.
```

**Providing a Service Implementation**

In order to provide an actual implementation of the Random service, we can utilize the Effect.provideService function.

```ts
// Providing the implementation
//
//      ┌─── Effect<void, never, never>
//      ▼
const runnable = Effect.provideService(program, Random, {
  next: Effect.sync(() => Math.random())
})

// Run successfully
Effect.runPromise(runnable)
/*
Example Output:
random number: 0.8241872233134417
*/
```

**Extracting the Service Type**

```ts
import { Effect, Context } from "effect"

// Declaring a tag
class Random extends Context.Tag("MyRandomService")<
  Random,
  { readonly next: Effect.Effect<number> }
>() {}

// Extracting the type
type RandomShape = Context.Tag.Service<Random>
/*
This is equivalent to:
type RandomShape = {
    readonly next: Effect.Effect<number>;
}
*/
```

---

# State Management

**Ref**
```ts
import { Effect, Ref } from "effect"

class Counter {
  inc: Effect.Effect<void>
  dec: Effect.Effect<void>
  get: Effect.Effect<number>

  constructor(private value: Ref.Ref<number>) {
    this.inc = Ref.update(this.value, (n) => n + 1)
    this.dec = Ref.update(this.value, (n) => n - 1)
    this.get = Ref.get(this.value)
  }
}

const make = Effect.andThen(Ref.make(0), (value) => new Counter(value))

const program = Effect.gen(function* () {
  const counter = yield* make
  yield* counter.inc
  yield* counter.inc
  yield* counter.dec
  yield* counter.inc
  const value = yield* counter.get
  console.log(`This counter has a value of ${value}.`)
})

Effect.runPromise(program)
```

**Using Ref in a Concurrent Environment**

```ts
const program = Effect.gen(function* () {
  const counter = yield* make

  // Helper to log the counter's value before running an effect
  const logCounter = <R, E, A>(
    label: string,
    effect: Effect.Effect<A, E, R>
  ) =>
    Effect.gen(function* () {
      const value = yield* counter.get
      yield* Effect.log(`${label} get: ${value}`)
      return yield* effect
    })

  yield* logCounter("task 1", counter.inc).pipe(
    Effect.zip(logCounter("task 2", counter.inc), { concurrent: true }),
    Effect.zip(logCounter("task 3", counter.dec), { concurrent: true }),
    Effect.zip(logCounter("task 4", counter.inc), { concurrent: true })
  )
  const value = yield* counter.get
  yield* Effect.log(`This counter has a value of ${value}.`)
})

Effect.runPromise(program)
/*
Output:
timestamp=... fiber=#3 message="task 4 get: 0"
timestamp=... fiber=#6 message="task 3 get: 1"
timestamp=... fiber=#8 message="task 1 get: 0"
timestamp=... fiber=#9 message="task 2 get: 1"
timestamp=... fiber=#0 message="This counter has a value of 2."
*/

```

**Using Ref as a Service**

You can pass a Ref as a service to share state across different parts of your program.

```ts
import { Effect, Context, Ref } from "effect"

// Create a Tag for our state
class MyState extends Context.Tag("MyState")<
  MyState,
  Ref.Ref<number>
>() {}

// Subprogram 1: Increment the state value twice
const subprogram1 = Effect.gen(function* () {
  const state = yield* MyState
  yield* Ref.update(state, (n) => n + 1)
  yield* Ref.update(state, (n) => n + 1)
})

// Subprogram 2: Decrement the state value and then increment it
const subprogram2 = Effect.gen(function* () {
  const state = yield* MyState
  yield* Ref.update(state, (n) => n - 1)
  yield* Ref.update(state, (n) => n + 1)
})

// Subprogram 3: Read and log the current value of the state
const subprogram3 = Effect.gen(function* () {
  const state = yield* MyState
  const value = yield* Ref.get(state)
  console.log(`MyState has a value of ${value}.`)
})

// Compose subprograms 1, 2, and 3 to create the main program
const program = Effect.gen(function* () {
  yield* subprogram1
  yield* subprogram2
  yield* subprogram3
})

// Create a Ref instance with an initial value of 0
const initialState = Ref.make(0)

// Provide the Ref as a service
const runnable = program.pipe(
  Effect.provideServiceEffect(MyState, initialState)
)

// Run the program and observe the output
Effect.runPromise(runnable)
/*
Output:
MyState has a value of 2.
*/
```

---

# Resources
- [CONCEPTS.md](.docs/CONCEPTS.md) - Detailed explanation of TS concepts
- [Constructor Cheatsheet](https://effect.website/docs/getting-started/creating-effects/#cheatsheet)

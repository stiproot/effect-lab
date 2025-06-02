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


# Resources
- [CONCEPTS.md](CONCEPTS.md) - Detailed explanation of TS concepts

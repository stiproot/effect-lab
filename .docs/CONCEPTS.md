
# `never` type:
In TypeScript, never represents a type that has no possible value.

```ts
function throwError(message: string): never {
  throw new Error(message);
}

function infiniteLoop(): never {
  while (true) {
    // never ends
  }
}
```

---

# Conditional Types

```ts
type ExcludeString<T> = T extends string ? never : T;
```

The shape is:
```ts
A extends B ? X : Y
```

Which means:
If type `A` can be assigned to type `B`, the result is `X`.
Else, the result is `Y`.

So, `ExcludeString<T>` says:
For any type `T`, if it’s a string, we exclude it by mapping to `never`.
If it’s not a string, we keep it as-is.

---

# How unions distribute

When you pass in:
```ts
type Result = ExcludeString<string | number>;
```

You're providing a union type: `string | number`.

**Conditional types distribute over union types**

That means:
```ts
ExcludeString<A | B> -> ExcludeString<A> | ExcludeString<B>
```

So:
```ts
ExcludeString<string | number>
-> ExcludeString<string> | ExcludeString<number>
-> (string extends string ? never : string) | (number extends string ? never : number)
-> never | number
-> number
```

So:
Because string obviously extends itself → so it takes the never branch.
number extends string? No → so it takes the T branch → keeps number.

Why is `never | number` simplified to `number`?
In TypeScript, `never` is:
- The bottom type → subtype of all types.
- Adding `never` to a union does nothing.

So:
```ts
never | number → number
```

---

# function*

This defines a generator function in JavaScript or TypeScript.

A generator is a special kind of function that:
- can pause in the middle (using `yield`)
- can resume later from where it left off
- returns an iterator object — something you can loop over (for..of), call .next() on, etc.

```ts
function* myGenerator() {
  yield 1;
  yield 2;
  yield 3;
}

// using it...
const gen = myGenerator();
console.log(gen.next()); // { value: 1, done: false }
console.log(gen.next()); // { value: 2, done: false }
console.log(gen.next()); // { value: 3, done: false }
console.log(gen.next()); // { value: undefined, done: true }
```

Why do you see `function*` and `yield*` in Effect?
In effect, the `Effect.gen(function* (_) { ... })` pattern is used to sequence multiple effects in a way that looks like synchronous code, but under the hood it’s chaining effectful computations.

```ts
Effect.gen(function* (_) {
  const user = yield* _(getUserEffect);
  const details = yield* _(getUserDetailsEffect(user.id));
  return details;
});
```

Here, `yield* _(effect)` → runs the effect and gives you the result, but inside a generator, so the runtime knows how to handle the sequencing.

The yield* part:
- yield → pause and return
- * → delegate to another iterator or value (like flattening it)

In short, `yield*` lets you yield values from another generator or iterator.


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

**Summary**
- function* -> Defines a generator function that can yield multiple values
- yield -> Inside a generator, pause and return a value, resume later
- yield* -> Inside a generator, delegate to another generator or iterator

---

**Union Types, Intersection Types, Literal Types:**
```ts
type ID = number | string; // Union type: can be a number OR a string
let userId: ID = 123;
userId = "abc";

type FullName = { firstName: string } & { lastName: string }; // Intersection type: combines properties
let personName: FullName = { firstName: "John", lastName: "Doe" };

type StatusCode = 200 | 404 | 500; // Literal type: only these specific values are allowed
let status: StatusCode = 200;
// status = 201; // Error!
```

**Self-referential / Recursive Types:**

Examples:

```ts
interface LinkedListNode {
  value: any;
  next: LinkedListNode | null; // Here, LinkedListNode refers to itself
}
```

```ts
type JSONObject = {
  [key: string]: string | number | boolean | JSONObject | JSONArray;
};
type JSONArray = (string | number | boolean | JSONObject | JSONArray)[];
```
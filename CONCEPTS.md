
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

**Summary**
- function* -> Defines a generator function that can yield multiple values
- yield -> Inside a generator, pause and return a value, resume later
- yield* -> Inside a generator, delegate to another generator or iterator

---

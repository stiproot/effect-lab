
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

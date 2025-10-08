interface Uint8Array extends TypedArray {
    readonly BYTES_PER_ELEMENT: number;
    readonly buffer: ArrayBuffer;
    readonly byteLength: number;
    readonly byteOffset: number;
    copyWithin(target: number, start: number, end?: number): this;
    every(predicate: (value: number, index: number, array: Uint8Array) => boolean, thisArg?: any): boolean;
    fill(value: number, start?: number, end?: number): this;
    filter(predicate: (value: number, index: number, array: Uint8Array) => boolean, thisArg?: any): Uint8Array;
    find(predicate: (value: number, index: number, array: Uint8Array) => boolean, thisArg?: any): number | undefined;
    findIndex(predicate: (value: number, index: number, array: Uint8Array) => boolean, thisArg?: any): number;
    forEach(callbackfn: (value: number, index: number, array: Uint8Array) => void, thisArg?: any): void;
    indexOf(searchElement: number, fromIndex?: number): number;
    join(separator?: string): string;
    lastIndexOf(searchElement: number, fromIndex?: number): number;
    map(callbackfn: (value: number, index: number, array: Uint8Array) => number, thisArg?: any): Uint8Array;
    reduce(callbackfn: (previousValue: number, currentValue: number, currentIndex: number, array: Uint8Array) => number): number;
    reduce(callbackfn: (previousValue: number, currentValue: number, currentIndex: number, array: Uint8Array) => number, initialValue: number): number;
    reduce<U>(callbackfn: (previousValue: U, currentValue: number, currentIndex: number, array: Uint8Array) => U, initialValue: U): U;
    reduceRight(callbackfn: (previousValue: number, currentValue: number, currentIndex: number, array: Uint8Array) => number): number;
    reduceRight(callbackfn: (previousValue: number, currentValue: number, currentIndex: number, array: Uint8Array) => number, initialValue: number): number;
    reduceRight<U>(callbackfn: (previousValue: U, currentValue: number, currentIndex: number, array: Uint8Array) => U, initialValue: U): U;
    reverse(): this;
    slice(start?: number, end?: number): Uint8Array;
    some(predicate: (value: number, index: number, array: Uint8Array) => boolean, thisArg?: any): boolean;
    sort(compareFn?: (a: number, b: number) => number): this;
    subarray(begin?: number, end?: number): Uint8Array;
    toLocaleString(): string;
    toString(): string;
    [Symbol.iterator](): IterableIterator<number>;
    entries(): IterableIterator<[number, number]>;
    keys(): IterableIterator<number>;
    values(): IterableIterator<number>;
    includes(searchElement: number, fromIndex?: number): boolean;
    at(index: number): number | undefined;
}

interface Uint8ArrayConstructor {
    readonly prototype: Uint8Array;
    new(length: number): Uint8Array;
    new(array: ArrayLike<number>): Uint8Array;
    new(buffer: ArrayBufferLike, byteOffset?: number, length?: number): Uint8Array;
    from(arrayLike: ArrayLike<number>, mapfn?: (v: number, k: number) => number, thisArg?: any): Uint8Array;
    from<T>(arrayLike: ArrayLike<T>, mapfn: (v: T, k: number) => number, thisArg?: any): Uint8Array;
    of(...items: number[]): Uint8Array;
}

declare var Uint8Array: Uint8ArrayConstructor;

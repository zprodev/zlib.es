export declare class Uint8ArrayEx {
    private _buffer;
    private _maxSize;
    private _extendedSize;
    private _nowIndex;
    constructor(size: number);
    set(value: number): void;
    readonly index: number;
    readonly length: number;
    readonly data: Uint8Array;
}

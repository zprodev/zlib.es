export declare class Uint8WriteStream {
    index: number;
    buffer: Uint8Array;
    length: number;
    private _extendedSize;
    constructor(extendedSize: number);
    write(value: number): void;
}

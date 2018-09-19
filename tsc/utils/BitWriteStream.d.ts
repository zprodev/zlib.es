export declare class BitWriteStream {
    buffer: Uint8Array;
    bufferIndex: number;
    nowBits: number;
    nowBitsIndex: number;
    isEnd: boolean;
    constructor(buffer: Uint8Array, bufferOffset?: number, bitsOffset?: number);
    write(bit: number): void;
    writeRange(value: number, length: number): void;
    writeRangeCoded(value: number, length: number): void;
}

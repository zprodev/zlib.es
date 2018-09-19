export declare class BitStream {
    buffer: Uint8Array;
    bufferIndex: number;
    nowBits: number;
    nowBitsIndex: number;
    isEnd: boolean;
    constructor(buffer: Uint8Array, offset?: number);
    read(): number;
    readRange(length: number): number;
    readRangeCoded(length: number): number;
}

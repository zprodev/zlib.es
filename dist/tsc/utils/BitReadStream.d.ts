export declare class BitReadStream {
    buffer: Uint8Array;
    bufferIndex: number;
    nowBits: number;
    nowBitsLength: number;
    isEnd: boolean;
    constructor(buffer: Uint8Array, offset?: number);
    read(): number;
    readRange(length: number): number;
    readRangeCoded(length: number): number;
}

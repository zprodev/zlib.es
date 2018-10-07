export declare function generateHuffmanTable(codelenValues: Map<number, number[]>): Map<number, Map<number, number>>;
export declare function makeFixedHuffmanCodelenValues(): Map<number, number[]>;
export declare function generateDeflateHuffmanTable(values: number[]): Map<number, {
    code: number;
    bitlen: number;
}>;

export interface ICodelenValues {
    [key: number]: number[];
}
export interface IHuffmanTable {
    [key: number]: {
        [key: number]: number;
    };
}
export declare function generateHuffmanTable(codelenValues: ICodelenValues): IHuffmanTable;
export declare function makeFixedHuffmanCodelenValues(): ICodelenValues;
export declare function generateDeflateHuffmanTable(values: number[]): Map<number, {
    code: number;
    bitlen: number;
}>;

const BTYPE = Object.freeze({
    UNCOMPRESSED: 0,
    FIXED: 1,
    DYNAMIC: 2,
});
const BLOCK_MAX_BUFFER_LEN = 131072;
const LENGTH_EXTRA_BIT_LEN = [
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
    4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const LENGTH_EXTRA_BIT_BASE = [
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13,
    15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
    67, 83, 99, 115, 131, 163, 195, 227, 258,
];
const DISTANCE_EXTRA_BIT_BASE = [
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25,
    33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
    1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577,
];
const DISTANCE_EXTRA_BIT_LEN = [
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3,
    4, 4, 5, 5, 6, 6, 7, 7, 8, 8,
    9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
const CODELEN_VALUES = [
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

function generateHuffmanTable(codelenValues) {
    const codelens = codelenValues.keys();
    let iteratorResult = codelens.next();
    let codelen = 0;
    let codelenMax = 0;
    let codelenMin = Number.MAX_SAFE_INTEGER;
    while (!iteratorResult.done) {
        codelen = iteratorResult.value;
        if (codelenMax < codelen) {
            codelenMax = codelen;
        }
        if (codelenMin > codelen) {
            codelenMin = codelen;
        }
        iteratorResult = codelens.next();
    }
    let code = 0;
    let values;
    const bitlenTables = new Map();
    for (let bitlen = codelenMin; bitlen <= codelenMax; bitlen++) {
        values = codelenValues.get(bitlen);
        values.sort((a, b) => {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        });
        const table = new Map();
        values.forEach((value) => {
            table.set(code, value);
            code++;
        });
        bitlenTables.set(bitlen, table);
        code <<= 1;
    }
    return bitlenTables;
}
function makeFixedHuffmanCodelenValues() {
    const codelenValues = new Map();
    codelenValues.set(7, new Array());
    codelenValues.set(8, new Array());
    codelenValues.set(9, new Array());
    for (let i = 0; i <= 287; i++) {
        (i <= 143) ? codelenValues.get(8).push(i) :
            (i <= 255) ? codelenValues.get(9).push(i) :
                (i <= 279) ? codelenValues.get(7).push(i) :
                    codelenValues.get(8).push(i);
    }
    return codelenValues;
}

class BitStream {
    constructor(buffer, offset = 0) {
        this.nowBitsIndex = 0;
        this.isEnd = false;
        this.buffer = buffer;
        this.bufferIndex = offset;
        this.nowBits = buffer[offset];
    }
    read() {
        if (this.isEnd) {
            throw new Error('Lack of data length');
        }
        const bit = this.nowBits & 1;
        if (this.nowBitsIndex < 7) {
            this.nowBitsIndex++;
            this.nowBits >>= 1;
        }
        else {
            this.bufferIndex++;
            this.nowBitsIndex = 0;
            if (this.bufferIndex < this.buffer.length) {
                this.nowBits = this.buffer[this.bufferIndex];
            }
            else {
                this.isEnd = true;
            }
        }
        return bit;
    }
    readRange(length) {
        let bits = 0;
        for (let i = 0; i < length; i++) {
            bits |= this.read() << i;
        }
        return bits;
    }
    readRangeCoded(length) {
        let bits = 0;
        for (let i = 0; i < length; i++) {
            bits <<= 1;
            bits |= this.read();
        }
        return bits;
    }
}

const FIXED_HUFFMAN_TABLE = generateHuffmanTable(makeFixedHuffmanCodelenValues());
function inflate(input, offset = 0) {
    let buffer = new Uint8Array(BLOCK_MAX_BUFFER_LEN);
    let bufferIndex = 0;
    const stream = new BitStream(input, offset);
    let bFinal = 0;
    let bType = 0;
    while (bFinal !== 1) {
        if (buffer.length < bufferIndex + BLOCK_MAX_BUFFER_LEN) {
            const newBuffer = new Uint8Array(buffer.length + BLOCK_MAX_BUFFER_LEN);
            newBuffer.set(buffer);
            buffer = newBuffer;
        }
        bFinal = stream.readRange(1);
        bType = stream.readRange(2);
        if (bType === BTYPE.UNCOMPRESSED) {
            bufferIndex = inflateUncompressedBlock(stream, buffer, bufferIndex);
        }
        else if (bType === BTYPE.FIXED) {
            bufferIndex = inflateFixedBlock(stream, buffer, bufferIndex);
        }
        else if (bType === BTYPE.DYNAMIC) {
            bufferIndex = inflateDynamicBlock(stream, buffer, bufferIndex);
        }
        else {
            throw new Error('Not supported BTYPE : ' + bType);
        }
        if (bFinal === 0 && stream.isEnd) {
            throw new Error('Data length is insufficient');
        }
    }
    return buffer.subarray(0, bufferIndex);
}
function inflateUncompressedBlock(stream, buffer, bufferIndex) {
    // Discard the padding
    stream.readRange(5);
    const LEN = stream.readRange(8) | stream.readRange(8) << 8;
    const NLEN = stream.readRange(8) | stream.readRange(8) << 8;
    if ((LEN + NLEN) !== 65535) {
        throw new Error('Data is corrupted');
    }
    for (let i = 0; i < LEN; i++) {
        buffer[bufferIndex] = stream.readRange(8);
        bufferIndex++;
    }
    return bufferIndex;
}
function inflateFixedBlock(stream, buffer, bufferIndex) {
    const tables = FIXED_HUFFMAN_TABLE;
    const codelens = tables.keys();
    let iteratorResult = codelens.next();
    let codelen = 0;
    let codelenMax = 0;
    let codelenMin = Number.MAX_SAFE_INTEGER;
    while (!iteratorResult.done) {
        codelen = iteratorResult.value;
        if (codelenMax < codelen) {
            codelenMax = codelen;
        }
        if (codelenMin > codelen) {
            codelenMin = codelen;
        }
        iteratorResult = codelens.next();
    }
    let code = 0;
    let table;
    let value;
    let repeatLengthCode;
    let repeatLengthValue;
    let repeatLengthExt;
    let repeatDistanceCode;
    let repeatDistanceValue;
    let repeatDistanceExt;
    let repeatStartIndex;
    while (!stream.isEnd) {
        value = undefined;
        codelen = codelenMin;
        code = stream.readRangeCoded(codelenMin - 1);
        while (codelen <= codelenMax) {
            table = tables.get(codelen);
            code <<= 1;
            code |= stream.read();
            value = table.get(code);
            if (value !== undefined) {
                break;
            }
            codelen++;
        }
        if (value === undefined) {
            throw new Error('Data is corrupted');
        }
        if (value < 256) {
            buffer[bufferIndex] = value;
            bufferIndex++;
            continue;
        }
        if (value === 256) {
            break;
        }
        repeatLengthCode = value - 257;
        repeatLengthValue = LENGTH_EXTRA_BIT_BASE[repeatLengthCode];
        repeatLengthExt = LENGTH_EXTRA_BIT_LEN[repeatLengthCode];
        if (0 < repeatLengthExt) {
            repeatLengthValue += stream.readRangeCoded(repeatLengthExt);
        }
        repeatDistanceCode = stream.readRangeCoded(5);
        repeatDistanceValue = DISTANCE_EXTRA_BIT_BASE[repeatDistanceCode];
        repeatDistanceExt = DISTANCE_EXTRA_BIT_LEN[repeatDistanceCode];
        if (0 < repeatDistanceExt) {
            repeatDistanceValue += stream.readRangeCoded(repeatDistanceExt);
        }
        repeatStartIndex = bufferIndex - repeatDistanceValue;
        for (let i = 0; i < repeatLengthValue; i++) {
            buffer[bufferIndex] = buffer[repeatStartIndex + i];
            bufferIndex++;
        }
    }
    return bufferIndex;
}
function inflateDynamicBlock(stream, buffer, bufferIndex) {
    const HLIT = stream.readRange(5) + 257;
    const HDIST = stream.readRange(5) + 1;
    const HCLEN = stream.readRange(4) + 4;
    let codelenCodelen = 0;
    const codelenCodelenValues = new Map();
    for (let i = 0; i < HCLEN; i++) {
        codelenCodelen = stream.readRange(3);
        if (codelenCodelen === 0) {
            continue;
        }
        if (!codelenCodelenValues.has(codelenCodelen)) {
            codelenCodelenValues.set(codelenCodelen, new Array());
        }
        codelenCodelenValues.get(codelenCodelen).push(CODELEN_VALUES[i]);
    }
    const codelenHuffmanTables = generateHuffmanTable(codelenCodelenValues);
    const codelenCodelens = codelenHuffmanTables.keys();
    let codelenCodelensIteratorResult = codelenCodelens.next();
    let codelenCodelenMax = 0;
    let codelenCodelenMin = Number.MAX_SAFE_INTEGER;
    while (!codelenCodelensIteratorResult.done) {
        codelenCodelen = codelenCodelensIteratorResult.value;
        if (codelenCodelenMax < codelenCodelen) {
            codelenCodelenMax = codelenCodelen;
        }
        if (codelenCodelenMin > codelenCodelen) {
            codelenCodelenMin = codelenCodelen;
        }
        codelenCodelensIteratorResult = codelenCodelens.next();
    }
    const dataCodelenValues = new Map();
    const distanceCodelenValues = new Map();
    let codelenCode = 0;
    let codelenHuffmanTable;
    let runlengthCode;
    let repeat = 0;
    let codelen = 0;
    const codesNumber = HLIT + HDIST;
    for (let i = 0; i < codesNumber;) {
        runlengthCode = undefined;
        codelenCodelen = codelenCodelenMin;
        codelenCode = stream.readRangeCoded(codelenCodelenMin - 1);
        while (codelenCodelen <= codelenCodelenMax) {
            codelenHuffmanTable = codelenHuffmanTables.get(codelenCodelen);
            codelenCode <<= 1;
            codelenCode |= stream.read();
            runlengthCode = codelenHuffmanTable.get(codelenCode);
            if (runlengthCode !== undefined) {
                break;
            }
            codelenCodelen++;
        }
        if (runlengthCode === undefined) {
            throw new Error('Data is corrupted');
        }
        if (runlengthCode === 16) {
            repeat = 3 + stream.readRange(2);
        }
        else if (runlengthCode === 17) {
            repeat = 3 + stream.readRange(3);
            codelen = 0;
        }
        else if (runlengthCode === 18) {
            repeat = 11 + stream.readRange(7);
            codelen = 0;
        }
        else {
            repeat = 1;
            codelen = runlengthCode;
        }
        while (repeat) {
            if (codelen <= 0) {
                i += repeat;
                break;
            }
            if (i < HLIT) {
                if (!dataCodelenValues.has(codelen)) {
                    dataCodelenValues.set(codelen, new Array());
                }
                dataCodelenValues.get(codelen).push(i++);
            }
            else {
                if (!distanceCodelenValues.has(codelen)) {
                    distanceCodelenValues.set(codelen, new Array());
                }
                distanceCodelenValues.get(codelen).push(i++ - HLIT);
            }
            repeat--;
        }
    }
    const dataHuffmanTables = generateHuffmanTable(dataCodelenValues);
    const distanceHuffmanTables = generateHuffmanTable(distanceCodelenValues);
    const dataCodelens = dataHuffmanTables.keys();
    let dataCodelensIteratorResult = dataCodelens.next();
    let dataCodelen = 0;
    let dataCodelenMax = 0;
    let dataCodelenMin = Number.MAX_SAFE_INTEGER;
    while (!dataCodelensIteratorResult.done) {
        dataCodelen = dataCodelensIteratorResult.value;
        if (dataCodelenMax < dataCodelen) {
            dataCodelenMax = dataCodelen;
        }
        if (dataCodelenMin > dataCodelen) {
            dataCodelenMin = dataCodelen;
        }
        dataCodelensIteratorResult = dataCodelens.next();
    }
    const distanceCodelens = distanceHuffmanTables.keys();
    let distanceCodelensIteratorResult = distanceCodelens.next();
    let distanceCodelen = 0;
    let distanceCodelenMax = 0;
    let distanceCodelenMin = Number.MAX_SAFE_INTEGER;
    while (!distanceCodelensIteratorResult.done) {
        distanceCodelen = distanceCodelensIteratorResult.value;
        if (distanceCodelenMax < distanceCodelen) {
            distanceCodelenMax = distanceCodelen;
        }
        if (distanceCodelenMin > distanceCodelen) {
            distanceCodelenMin = distanceCodelen;
        }
        distanceCodelensIteratorResult = distanceCodelens.next();
    }
    let dataCode = 0;
    let dataHuffmanTable;
    let data;
    let repeatLengthCode;
    let repeatLengthValue;
    let repeatLengthExt;
    let repeatDistanceCode;
    let repeatDistanceValue;
    let repeatDistanceExt;
    let repeatDistanceCodeCodelen;
    let repeatDistanceCodeCode;
    let distanceHuffmanTable;
    let repeatStartIndex;
    while (!stream.isEnd) {
        data = undefined;
        dataCodelen = dataCodelenMin;
        dataCode = stream.readRangeCoded(dataCodelenMin - 1);
        while (dataCodelen <= dataCodelenMax) {
            dataHuffmanTable = dataHuffmanTables.get(dataCodelen);
            dataCode <<= 1;
            dataCode |= stream.read();
            data = dataHuffmanTable.get(dataCode);
            if (data !== undefined) {
                break;
            }
            dataCodelen++;
        }
        if (data === undefined) {
            throw new Error('Data is corrupted');
        }
        if (data < 256) {
            buffer[bufferIndex] = data;
            bufferIndex++;
            continue;
        }
        if (data === 256) {
            break;
        }
        repeatLengthCode = data - 257;
        repeatLengthValue = LENGTH_EXTRA_BIT_BASE[repeatLengthCode];
        repeatLengthExt = LENGTH_EXTRA_BIT_LEN[repeatLengthCode];
        if (0 < repeatLengthExt) {
            repeatLengthValue += stream.readRangeCoded(repeatLengthExt);
        }
        repeatDistanceCode = undefined;
        repeatDistanceCodeCodelen = distanceCodelenMin;
        repeatDistanceCodeCode = stream.readRangeCoded(distanceCodelenMin - 1);
        while (repeatDistanceCodeCodelen <= distanceCodelenMax) {
            distanceHuffmanTable = distanceHuffmanTables.get(repeatDistanceCodeCodelen);
            repeatDistanceCodeCode <<= 1;
            repeatDistanceCodeCode |= stream.read();
            repeatDistanceCode = distanceHuffmanTable.get(repeatDistanceCodeCode);
            if (repeatDistanceCode !== undefined) {
                break;
            }
            repeatDistanceCodeCodelen++;
        }
        if (repeatDistanceCode === undefined) {
            throw new Error('Data is corrupted');
        }
        repeatDistanceValue = DISTANCE_EXTRA_BIT_BASE[repeatDistanceCode];
        repeatDistanceExt = DISTANCE_EXTRA_BIT_LEN[repeatDistanceCode];
        if (0 < repeatDistanceExt) {
            repeatDistanceValue += stream.readRangeCoded(repeatDistanceExt);
        }
        repeatStartIndex = bufferIndex - repeatDistanceValue;
        for (let i = 0; i < repeatLengthValue; i++) {
            buffer[bufferIndex] = buffer[repeatStartIndex + i];
            bufferIndex++;
        }
    }
    return bufferIndex;
}

function inflate$1(input) {
    const stream = new BitStream(input);
    const CM = stream.readRange(4);
    const CINFO = stream.readRange(4);
    const FCHECK = stream.readRange(5);
    const FDICT = stream.readRange(1);
    const FLEVEL = stream.readRange(2);
    return inflate(input, 2);
}

export { inflate$1 as inflate };

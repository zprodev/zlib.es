import { BTYPE, CODELEN_VALUES, DISTANCE_EXTRA_BIT_BASE, DISTANCE_EXTRA_BIT_LEN, LENGTH_EXTRA_BIT_BASE, LENGTH_EXTRA_BIT_LEN, } from './const';
import { generateHuffmanTable, makeFixedHuffmanCodelenValues } from './huffman';
import { BitReadStream } from './utils/BitReadStream';
import { Uint8WriteStream } from './utils/Uint8WriteStream';
const FIXED_HUFFMAN_TABLE = generateHuffmanTable(makeFixedHuffmanCodelenValues());
export function inflate(input, offset = 0) {
    const buffer = new Uint8WriteStream(input.length * 10);
    const stream = new BitReadStream(input, offset);
    let bFinal = 0;
    let bType = 0;
    while (bFinal !== 1) {
        bFinal = stream.readRange(1);
        bType = stream.readRange(2);
        if (bType === BTYPE.UNCOMPRESSED) {
            inflateUncompressedBlock(stream, buffer);
        }
        else if (bType === BTYPE.FIXED) {
            inflateFixedBlock(stream, buffer);
        }
        else if (bType === BTYPE.DYNAMIC) {
            inflateDynamicBlock(stream, buffer);
        }
        else {
            throw new Error('Not supported BTYPE : ' + bType);
        }
        if (bFinal === 0 && stream.isEnd) {
            throw new Error('Data length is insufficient');
        }
    }
    return buffer.buffer.subarray(0, buffer.index);
}
function inflateUncompressedBlock(stream, buffer) {
    // Skip to byte boundary
    if (stream.nowBitsLength < 8) {
        stream.readRange(stream.nowBitsLength);
    }
    const LEN = stream.readRange(8) | stream.readRange(8) << 8;
    const NLEN = stream.readRange(8) | stream.readRange(8) << 8;
    if ((LEN + NLEN) !== 65535) {
        throw new Error('Data is corrupted');
    }
    for (let i = 0; i < LEN; i++) {
        buffer.write(stream.readRange(8));
    }
}
function inflateFixedBlock(stream, buffer) {
    const tables = FIXED_HUFFMAN_TABLE;
    const codelens = Object.keys(tables);
    let codelen = 0;
    let codelenMax = 0;
    let codelenMin = Number.MAX_SAFE_INTEGER;
    codelens.forEach((key) => {
        codelen = Number(key);
        if (codelenMax < codelen) {
            codelenMax = codelen;
        }
        if (codelenMin > codelen) {
            codelenMin = codelen;
        }
    });
    let code = 0;
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
        code = stream.readRangeCoded(codelenMin);
        while (true) {
            value = tables[codelen][code];
            if (value !== undefined) {
                break;
            }
            if (codelenMax <= codelen) {
                throw new Error('Data is corrupted');
            }
            codelen++;
            code <<= 1;
            code |= stream.read();
        }
        if (value < 256) {
            buffer.write(value);
            continue;
        }
        if (value === 256) {
            break;
        }
        repeatLengthCode = value - 257;
        repeatLengthValue = LENGTH_EXTRA_BIT_BASE[repeatLengthCode];
        repeatLengthExt = LENGTH_EXTRA_BIT_LEN[repeatLengthCode];
        if (0 < repeatLengthExt) {
            repeatLengthValue += stream.readRange(repeatLengthExt);
        }
        repeatDistanceCode = stream.readRangeCoded(5);
        repeatDistanceValue = DISTANCE_EXTRA_BIT_BASE[repeatDistanceCode];
        repeatDistanceExt = DISTANCE_EXTRA_BIT_LEN[repeatDistanceCode];
        if (0 < repeatDistanceExt) {
            repeatDistanceValue += stream.readRange(repeatDistanceExt);
        }
        repeatStartIndex = buffer.index - repeatDistanceValue;
        for (let i = 0; i < repeatLengthValue; i++) {
            buffer.write(buffer.buffer[repeatStartIndex + i]);
        }
    }
}
function inflateDynamicBlock(stream, buffer) {
    const HLIT = stream.readRange(5) + 257;
    const HDIST = stream.readRange(5) + 1;
    const HCLEN = stream.readRange(4) + 4;
    let codelenCodelen = 0;
    const codelenCodelenValues = {};
    for (let i = 0; i < HCLEN; i++) {
        codelenCodelen = stream.readRange(3);
        if (codelenCodelen === 0) {
            continue;
        }
        if (!codelenCodelenValues[codelenCodelen]) {
            codelenCodelenValues[codelenCodelen] = [];
        }
        codelenCodelenValues[codelenCodelen].push(CODELEN_VALUES[i]);
    }
    const codelenHuffmanTables = generateHuffmanTable(codelenCodelenValues);
    const codelenCodelens = Object.keys(codelenHuffmanTables);
    let codelenCodelenMax = 0;
    let codelenCodelenMin = Number.MAX_SAFE_INTEGER;
    codelenCodelens.forEach((key) => {
        codelenCodelen = Number(key);
        if (codelenCodelenMax < codelenCodelen) {
            codelenCodelenMax = codelenCodelen;
        }
        if (codelenCodelenMin > codelenCodelen) {
            codelenCodelenMin = codelenCodelen;
        }
    });
    const dataCodelenValues = {};
    const distanceCodelenValues = {};
    let codelenCode = 0;
    let runlengthCode;
    let repeat = 0;
    let codelen = 0;
    const codesNumber = HLIT + HDIST;
    for (let i = 0; i < codesNumber;) {
        runlengthCode = undefined;
        codelenCodelen = codelenCodelenMin;
        codelenCode = stream.readRangeCoded(codelenCodelenMin);
        while (true) {
            runlengthCode = codelenHuffmanTables[codelenCodelen][codelenCode];
            if (runlengthCode !== undefined) {
                break;
            }
            if (codelenCodelenMax <= codelenCodelen) {
                throw new Error('Data is corrupted');
            }
            codelenCodelen++;
            codelenCode <<= 1;
            codelenCode |= stream.read();
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
        if (codelen <= 0) {
            i += repeat;
        }
        else {
            while (repeat) {
                if (i < HLIT) {
                    if (!dataCodelenValues[codelen]) {
                        dataCodelenValues[codelen] = [];
                    }
                    dataCodelenValues[codelen].push(i++);
                }
                else {
                    if (!distanceCodelenValues[codelen]) {
                        distanceCodelenValues[codelen] = [];
                    }
                    distanceCodelenValues[codelen].push(i++ - HLIT);
                }
                repeat--;
            }
        }
    }
    const dataHuffmanTables = generateHuffmanTable(dataCodelenValues);
    const distanceHuffmanTables = generateHuffmanTable(distanceCodelenValues);
    const dataCodelens = Object.keys(dataHuffmanTables);
    let dataCodelen = 0;
    let dataCodelenMax = 0;
    let dataCodelenMin = Number.MAX_SAFE_INTEGER;
    dataCodelens.forEach((key) => {
        dataCodelen = Number(key);
        if (dataCodelenMax < dataCodelen) {
            dataCodelenMax = dataCodelen;
        }
        if (dataCodelenMin > dataCodelen) {
            dataCodelenMin = dataCodelen;
        }
    });
    const distanceCodelens = Object.keys(distanceHuffmanTables);
    let distanceCodelen = 0;
    let distanceCodelenMax = 0;
    let distanceCodelenMin = Number.MAX_SAFE_INTEGER;
    distanceCodelens.forEach((key) => {
        distanceCodelen = Number(key);
        if (distanceCodelenMax < distanceCodelen) {
            distanceCodelenMax = distanceCodelen;
        }
        if (distanceCodelenMin > distanceCodelen) {
            distanceCodelenMin = distanceCodelen;
        }
    });
    let dataCode = 0;
    let data;
    let repeatLengthCode;
    let repeatLengthValue;
    let repeatLengthExt;
    let repeatDistanceCode;
    let repeatDistanceValue;
    let repeatDistanceExt;
    let repeatDistanceCodeCodelen;
    let repeatDistanceCodeCode;
    let repeatStartIndex;
    while (!stream.isEnd) {
        data = undefined;
        dataCodelen = dataCodelenMin;
        dataCode = stream.readRangeCoded(dataCodelenMin);
        while (true) {
            data = dataHuffmanTables[dataCodelen][dataCode];
            if (data !== undefined) {
                break;
            }
            if (dataCodelenMax <= dataCodelen) {
                throw new Error('Data is corrupted');
            }
            dataCodelen++;
            dataCode <<= 1;
            dataCode |= stream.read();
        }
        if (data < 256) {
            buffer.write(data);
            continue;
        }
        if (data === 256) {
            break;
        }
        repeatLengthCode = data - 257;
        repeatLengthValue = LENGTH_EXTRA_BIT_BASE[repeatLengthCode];
        repeatLengthExt = LENGTH_EXTRA_BIT_LEN[repeatLengthCode];
        if (0 < repeatLengthExt) {
            repeatLengthValue += stream.readRange(repeatLengthExt);
        }
        repeatDistanceCode = undefined;
        repeatDistanceCodeCodelen = distanceCodelenMin;
        repeatDistanceCodeCode = stream.readRangeCoded(distanceCodelenMin);
        while (true) {
            repeatDistanceCode = distanceHuffmanTables[repeatDistanceCodeCodelen][repeatDistanceCodeCode];
            if (repeatDistanceCode !== undefined) {
                break;
            }
            if (distanceCodelenMax <= repeatDistanceCodeCodelen) {
                throw new Error('Data is corrupted');
            }
            repeatDistanceCodeCodelen++;
            repeatDistanceCodeCode <<= 1;
            repeatDistanceCodeCode |= stream.read();
        }
        repeatDistanceValue = DISTANCE_EXTRA_BIT_BASE[repeatDistanceCode];
        repeatDistanceExt = DISTANCE_EXTRA_BIT_LEN[repeatDistanceCode];
        if (0 < repeatDistanceExt) {
            repeatDistanceValue += stream.readRange(repeatDistanceExt);
        }
        repeatStartIndex = buffer.index - repeatDistanceValue;
        for (let i = 0; i < repeatLengthValue; i++) {
            buffer.write(buffer.buffer[repeatStartIndex + i]);
        }
    }
}

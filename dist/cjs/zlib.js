'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function calcAdler32(input) {
    let s1 = 1;
    let s2 = 0;
    const inputLen = input.length;
    for (let i = 0; i < inputLen; i++) {
        s1 = (s1 + input[i]) % 65521;
        s2 = (s1 + s2) % 65521;
    }
    return (s2 << 16) + s1;
}

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
    const codelens = Object.keys(codelenValues);
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
    let values;
    const bitlenTables = {};
    for (let bitlen = codelenMin; bitlen <= codelenMax; bitlen++) {
        values = codelenValues[bitlen];
        if (values === undefined) {
            values = [];
        }
        values.sort((a, b) => {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        });
        const table = {};
        values.forEach((value) => {
            table[code] = value;
            code++;
        });
        bitlenTables[bitlen] = table;
        code <<= 1;
    }
    return bitlenTables;
}
function makeFixedHuffmanCodelenValues() {
    const codelenValues = {};
    codelenValues[7] = [];
    codelenValues[8] = [];
    codelenValues[9] = [];
    for (let i = 0; i <= 287; i++) {
        (i <= 143) ? codelenValues[8].push(i) :
            (i <= 255) ? codelenValues[9].push(i) :
                (i <= 279) ? codelenValues[7].push(i) :
                    codelenValues[8].push(i);
    }
    return codelenValues;
}
function generateDeflateHuffmanTable(values, maxLength = 15) {
    const valuesCount = {};
    for (const value of values) {
        if (!valuesCount[value]) {
            valuesCount[value] = 1;
        }
        else {
            valuesCount[value]++;
        }
    }
    const valuesCountKeys = Object.keys(valuesCount);
    let tmpPackages = [];
    let tmpPackageIndex = 0;
    let packages = [];
    if (valuesCountKeys.length === 1) {
        packages.push({
            count: valuesCount[0],
            simbles: [Number(valuesCountKeys[0])],
        });
    }
    else {
        for (let i = 0; i < maxLength; i++) {
            packages = [];
            valuesCountKeys.forEach((value) => {
                const pack = {
                    count: valuesCount[Number(value)],
                    simbles: [Number(value)],
                };
                packages.push(pack);
            });
            tmpPackageIndex = 0;
            while (tmpPackageIndex + 2 <= tmpPackages.length) {
                const pack = {
                    count: tmpPackages[tmpPackageIndex].count + tmpPackages[tmpPackageIndex + 1].count,
                    simbles: tmpPackages[tmpPackageIndex].simbles.concat(tmpPackages[tmpPackageIndex + 1].simbles),
                };
                packages.push(pack);
                tmpPackageIndex += 2;
            }
            packages = packages.sort((a, b) => {
                if (a.count < b.count) {
                    return -1;
                }
                if (a.count > b.count) {
                    return 1;
                }
                return 0;
            });
            if (packages.length % 2 !== 0) {
                packages.pop();
            }
            tmpPackages = packages;
        }
    }
    const valuesCodelen = {};
    packages.forEach((pack) => {
        pack.simbles.forEach((symble) => {
            if (!valuesCodelen[symble]) {
                valuesCodelen[symble] = 1;
            }
            else {
                valuesCodelen[symble]++;
            }
        });
    });
    let group;
    const valuesCodelenKeys = Object.keys(valuesCodelen);
    const codelenGroup = {};
    let code = 0;
    let codelen = 3;
    let codelenValueMin = Number.MAX_SAFE_INTEGER;
    let codelenValueMax = 0;
    valuesCodelenKeys.forEach((valuesCodelenKey) => {
        codelen = valuesCodelen[Number(valuesCodelenKey)];
        if (!codelenGroup[codelen]) {
            codelenGroup[codelen] = [];
            if (codelenValueMin > codelen) {
                codelenValueMin = codelen;
            }
            if (codelenValueMax < codelen) {
                codelenValueMax = codelen;
            }
        }
        codelenGroup[codelen].push(Number(valuesCodelenKey));
    });
    code = 0;
    const table = new Map();
    for (let i = codelenValueMin; i <= codelenValueMax; i++) {
        group = codelenGroup[i];
        if (group) {
            group = group.sort((a, b) => {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            });
            group.forEach((value) => {
                table.set(value, { code, bitlen: i });
                code++;
            });
        }
        code <<= 1;
    }
    return table;
}

const REPEAT_LEN_MIN = 3;
const FAST_INDEX_CHECK_MAX = 128;
const FAST_INDEX_CHECK_MIN = 16;
const FAST_REPEAT_LENGTH = 8;
function generateLZ77IndexMap(input, startIndex, targetLength) {
    const end = startIndex + targetLength - REPEAT_LEN_MIN;
    const indexMap = {};
    for (let i = startIndex; i <= end; i++) {
        const indexKey = input[i] << 16 | input[i + 1] << 8 | input[i + 2];
        if (indexMap[indexKey] === undefined) {
            indexMap[indexKey] = [];
        }
        indexMap[indexKey].push(i);
    }
    return indexMap;
}
function generateLZ77Codes(input, startIndex, targetLength) {
    let nowIndex = startIndex;
    const endIndex = startIndex + targetLength - REPEAT_LEN_MIN;
    let slideIndexBase = 0;
    let repeatLength = 0;
    let repeatLengthMax = 0;
    let repeatLengthMaxIndex = 0;
    let distance = 0;
    let repeatLengthCodeValue = 0;
    let repeatDistanceCodeValue = 0;
    const codeTargetValues = [];
    const startIndexMap = {};
    const endIndexMap = {};
    const indexMap = generateLZ77IndexMap(input, startIndex, targetLength);
    while (nowIndex <= endIndex) {
        const indexKey = input[nowIndex] << 16 | input[nowIndex + 1] << 8 | input[nowIndex + 2];
        const indexes = indexMap[indexKey];
        if (indexes === undefined || indexes.length <= 1) {
            codeTargetValues.push([input[nowIndex]]);
            nowIndex++;
            continue;
        }
        slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0;
        repeatLengthMax = 0;
        repeatLengthMaxIndex = 0;
        let skipindexes = startIndexMap[indexKey] || 0;
        while (indexes[skipindexes] < slideIndexBase) {
            skipindexes = (skipindexes + 1) | 0;
        }
        startIndexMap[indexKey] = skipindexes;
        skipindexes = endIndexMap[indexKey] || 0;
        while (indexes[skipindexes] < nowIndex) {
            skipindexes = (skipindexes + 1) | 0;
        }
        endIndexMap[indexKey] = skipindexes;
        let checkCount = 0;
        indexMapLoop: for (let i = endIndexMap[indexKey] - 1, iMin = startIndexMap[indexKey]; iMin <= i; i--) {
            if (checkCount >= FAST_INDEX_CHECK_MAX
                || (repeatLengthMax >= FAST_REPEAT_LENGTH && checkCount >= FAST_INDEX_CHECK_MIN)) {
                break;
            }
            checkCount++;
            const index = indexes[i];
            for (let j = repeatLengthMax - 1; 0 < j; j--) {
                if (input[index + j] !== input[nowIndex + j]) {
                    continue indexMapLoop;
                }
            }
            repeatLength = 258;
            for (let j = repeatLengthMax; j <= 258; j++) {
                if (input[index + j] !== input[nowIndex + j]) {
                    repeatLength = j;
                    break;
                }
            }
            if (repeatLengthMax < repeatLength) {
                repeatLengthMax = repeatLength;
                repeatLengthMaxIndex = index;
                if (258 <= repeatLength) {
                    break;
                }
            }
        }
        if (repeatLengthMax >= 3 && nowIndex + repeatLengthMax <= endIndex) {
            distance = nowIndex - repeatLengthMaxIndex;
            for (let i = 0; i < LENGTH_EXTRA_BIT_BASE.length; i++) {
                if (LENGTH_EXTRA_BIT_BASE[i] > repeatLengthMax) {
                    break;
                }
                repeatLengthCodeValue = i;
            }
            for (let i = 0; i < DISTANCE_EXTRA_BIT_BASE.length; i++) {
                if (DISTANCE_EXTRA_BIT_BASE[i] > distance) {
                    break;
                }
                repeatDistanceCodeValue = i;
            }
            codeTargetValues.push([repeatLengthCodeValue, repeatDistanceCodeValue, repeatLengthMax, distance]);
            nowIndex += repeatLengthMax;
        }
        else {
            codeTargetValues.push([input[nowIndex]]);
            nowIndex++;
        }
    }
    codeTargetValues.push([input[nowIndex]]);
    codeTargetValues.push([input[nowIndex + 1]]);
    return codeTargetValues;
}

class BitWriteStream {
    constructor(buffer, bufferOffset = 0, bitsOffset = 0) {
        this.nowBitsIndex = 0;
        this.isEnd = false;
        this.buffer = buffer;
        this.bufferIndex = bufferOffset;
        this.nowBits = buffer[bufferOffset];
        this.nowBitsIndex = bitsOffset;
    }
    write(bit) {
        if (this.isEnd) {
            throw new Error('Lack of data length');
        }
        bit <<= this.nowBitsIndex;
        this.nowBits += bit;
        this.nowBitsIndex++;
        if (this.nowBitsIndex >= 8) {
            this.buffer[this.bufferIndex] = this.nowBits;
            this.bufferIndex++;
            this.nowBits = 0;
            this.nowBitsIndex = 0;
            if (this.buffer.length <= this.bufferIndex) {
                this.isEnd = true;
            }
        }
    }
    writeRange(value, length) {
        let mask = 1;
        let bit = 0;
        for (let i = 0; i < length; i++) {
            bit = (value & mask) ? 1 : 0;
            this.write(bit);
            mask <<= 1;
        }
    }
    writeRangeCoded(value, length) {
        let mask = 1 << (length - 1);
        let bit = 0;
        for (let i = 0; i < length; i++) {
            bit = (value & mask) ? 1 : 0;
            this.write(bit);
            mask >>>= 1;
        }
    }
}

function deflate(input) {
    const inputLength = input.length;
    const streamHeap = (inputLength < BLOCK_MAX_BUFFER_LEN / 2) ? BLOCK_MAX_BUFFER_LEN : inputLength * 2;
    const stream = new BitWriteStream(new Uint8Array(streamHeap));
    let processedLength = 0;
    let targetLength = 0;
    while (true) {
        if (processedLength + BLOCK_MAX_BUFFER_LEN >= inputLength) {
            targetLength = inputLength - processedLength;
            stream.writeRange(1, 1);
        }
        else {
            targetLength = BLOCK_MAX_BUFFER_LEN;
            stream.writeRange(0, 1);
        }
        stream.writeRange(BTYPE.DYNAMIC, 2);
        deflateDynamicBlock(stream, input, processedLength, targetLength);
        processedLength += BLOCK_MAX_BUFFER_LEN;
        if (processedLength >= inputLength) {
            break;
        }
    }
    if (stream.nowBitsIndex !== 0) {
        stream.writeRange(0, 8 - stream.nowBitsIndex);
    }
    return stream.buffer.subarray(0, stream.bufferIndex);
}
function deflateDynamicBlock(stream, input, startIndex, targetLength) {
    const lz77Codes = generateLZ77Codes(input, startIndex, targetLength);
    const clCodeValues = [256]; // character or matching length
    const distanceCodeValues = [];
    let clCodeValueMax = 256;
    let distanceCodeValueMax = 0;
    for (let i = 0, iMax = lz77Codes.length; i < iMax; i++) {
        const values = lz77Codes[i];
        let cl = values[0];
        const distance = values[1];
        if (distance !== undefined) {
            cl += 257;
            distanceCodeValues.push(distance);
            if (distanceCodeValueMax < distance) {
                distanceCodeValueMax = distance;
            }
        }
        clCodeValues.push(cl);
        if (clCodeValueMax < cl) {
            clCodeValueMax = cl;
        }
    }
    const dataHuffmanTables = generateDeflateHuffmanTable(clCodeValues);
    const distanceHuffmanTables = generateDeflateHuffmanTable(distanceCodeValues);
    const codelens = [];
    for (let i = 0; i <= clCodeValueMax; i++) {
        if (dataHuffmanTables.has(i)) {
            codelens.push(dataHuffmanTables.get(i).bitlen);
        }
        else {
            codelens.push(0);
        }
    }
    const HLIT = codelens.length;
    for (let i = 0; i <= distanceCodeValueMax; i++) {
        if (distanceHuffmanTables.has(i)) {
            codelens.push(distanceHuffmanTables.get(i).bitlen);
        }
        else {
            codelens.push(0);
        }
    }
    const HDIST = codelens.length - HLIT;
    const runLengthCodes = [];
    const runLengthRepeatCount = [];
    let codelen = 0;
    let repeatLength = 0;
    for (let i = 0; i < codelens.length; i++) {
        codelen = codelens[i];
        repeatLength = 1;
        while (codelen === codelens[i + 1]) {
            repeatLength++;
            i++;
            if (codelen === 0) {
                if (138 <= repeatLength) {
                    break;
                }
            }
            else {
                if (6 <= repeatLength) {
                    break;
                }
            }
        }
        if (4 <= repeatLength) {
            if (codelen === 0) {
                if (11 <= repeatLength) {
                    runLengthCodes.push(18);
                }
                else {
                    runLengthCodes.push(17);
                }
            }
            else {
                runLengthCodes.push(codelen);
                runLengthRepeatCount.push(1);
                repeatLength--;
                runLengthCodes.push(16);
            }
            runLengthRepeatCount.push(repeatLength);
        }
        else {
            for (let j = 0; j < repeatLength; j++) {
                runLengthCodes.push(codelen);
                runLengthRepeatCount.push(1);
            }
        }
    }
    const codelenHuffmanTable = generateDeflateHuffmanTable(runLengthCodes, 7);
    let HCLEN = 0;
    CODELEN_VALUES.forEach((value, index) => {
        if (codelenHuffmanTable.has(value)) {
            HCLEN = index + 1;
        }
    });
    // HLIT
    stream.writeRange(HLIT - 257, 5);
    // HDIST
    stream.writeRange(HDIST - 1, 5);
    // HCLEN
    stream.writeRange(HCLEN - 4, 4);
    let codelenTableObj;
    // codelenHuffmanTable
    for (let i = 0; i < HCLEN; i++) {
        codelenTableObj = codelenHuffmanTable.get(CODELEN_VALUES[i]);
        if (codelenTableObj !== undefined) {
            stream.writeRange(codelenTableObj.bitlen, 3);
        }
        else {
            stream.writeRange(0, 3);
        }
    }
    runLengthCodes.forEach((value, index) => {
        codelenTableObj = codelenHuffmanTable.get(value);
        if (codelenTableObj !== undefined) {
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
        }
        else {
            throw new Error('Data is corrupted');
        }
        if (value === 18) {
            stream.writeRange(runLengthRepeatCount[index] - 11, 7);
        }
        else if (value === 17) {
            stream.writeRange(runLengthRepeatCount[index] - 3, 3);
        }
        else if (value === 16) {
            stream.writeRange(runLengthRepeatCount[index] - 3, 2);
        }
    });
    for (let i = 0, iMax = lz77Codes.length; i < iMax; i++) {
        const values = lz77Codes[i];
        const clCodeValue = values[0];
        const distanceCodeValue = values[1];
        if (distanceCodeValue !== undefined) {
            codelenTableObj = dataHuffmanTables.get(clCodeValue + 257);
            if (codelenTableObj === undefined) {
                throw new Error('Data is corrupted');
            }
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
            if (0 < LENGTH_EXTRA_BIT_LEN[clCodeValue]) {
                repeatLength = values[2];
                stream.writeRange(repeatLength - LENGTH_EXTRA_BIT_BASE[clCodeValue], LENGTH_EXTRA_BIT_LEN[clCodeValue]);
            }
            const distanceTableObj = distanceHuffmanTables.get(distanceCodeValue);
            if (distanceTableObj === undefined) {
                throw new Error('Data is corrupted');
            }
            stream.writeRangeCoded(distanceTableObj.code, distanceTableObj.bitlen);
            if (0 < DISTANCE_EXTRA_BIT_LEN[distanceCodeValue]) {
                const distance = values[3];
                stream.writeRange(distance - DISTANCE_EXTRA_BIT_BASE[distanceCodeValue], DISTANCE_EXTRA_BIT_LEN[distanceCodeValue]);
            }
        }
        else {
            codelenTableObj = dataHuffmanTables.get(clCodeValue);
            if (codelenTableObj === undefined) {
                throw new Error('Data is corrupted');
            }
            stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
        }
    }
    codelenTableObj = dataHuffmanTables.get(256);
    if (codelenTableObj === undefined) {
        throw new Error('Data is corrupted');
    }
    stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
}

class BitReadStream {
    constructor(buffer, offset = 0) {
        this.nowBitsLength = 0;
        this.isEnd = false;
        this.buffer = buffer;
        this.bufferIndex = offset;
        this.nowBits = buffer[offset];
        this.nowBitsLength = 8;
    }
    read() {
        if (this.isEnd) {
            throw new Error('Lack of data length');
        }
        const bit = this.nowBits & 1;
        if (this.nowBitsLength > 1) {
            this.nowBitsLength--;
            this.nowBits >>= 1;
        }
        else {
            this.bufferIndex++;
            if (this.bufferIndex < this.buffer.length) {
                this.nowBits = this.buffer[this.bufferIndex];
                this.nowBitsLength = 8;
            }
            else {
                this.nowBitsLength = 0;
                this.isEnd = true;
            }
        }
        return bit;
    }
    readRange(length) {
        while (this.nowBitsLength <= length) {
            this.nowBits |= this.buffer[++this.bufferIndex] << this.nowBitsLength;
            this.nowBitsLength += 8;
        }
        const bits = this.nowBits & ((1 << length) - 1);
        this.nowBits >>>= length;
        this.nowBitsLength -= length;
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

class Uint8WriteStream {
    constructor(extendedSize) {
        this.index = 0;
        this.buffer = new Uint8Array(extendedSize);
        this.length = extendedSize;
        this._extendedSize = extendedSize;
    }
    write(value) {
        if (this.length <= this.index) {
            this.length += this._extendedSize;
            const newBuffer = new Uint8Array(this.length);
            const nowSize = this.buffer.length;
            for (let i = 0; i < nowSize; i++) {
                newBuffer[i] = this.buffer[i];
            }
            this.buffer = newBuffer;
        }
        this.buffer[this.index] = value;
        this.index++;
    }
}

const FIXED_HUFFMAN_TABLE = generateHuffmanTable(makeFixedHuffmanCodelenValues());
function inflate(input, offset = 0) {
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

function inflate$1(input) {
    const stream = new BitReadStream(input);
    const CM = stream.readRange(4);
    if (CM !== 8) {
        throw new Error('Not compressed by deflate');
    }
    const CINFO = stream.readRange(4);
    const FCHECK = stream.readRange(5);
    const FDICT = stream.readRange(1);
    const FLEVEL = stream.readRange(2);
    return inflate(input, 2);
}
function deflate$1(input) {
    const data = deflate(input);
    const CMF = new BitWriteStream(new Uint8Array(1));
    CMF.writeRange(8, 4);
    CMF.writeRange(7, 4);
    const FLG = new BitWriteStream(new Uint8Array(1));
    FLG.writeRange(28, 5);
    FLG.writeRange(0, 1);
    FLG.writeRange(2, 2);
    const ADLER32 = new BitWriteStream(new Uint8Array(4));
    const adler32 = calcAdler32(input);
    ADLER32.writeRange(adler32 >>> 24, 8);
    ADLER32.writeRange((adler32 >>> 16) & 0xff, 8);
    ADLER32.writeRange((adler32 >>> 8) & 0xff, 8);
    ADLER32.writeRange(adler32 & 0xff, 8);
    const output = new Uint8Array(data.length + 6);
    output.set(CMF.buffer);
    output.set(FLG.buffer, 1);
    output.set(data, 2);
    output.set(ADLER32.buffer, output.length - 4);
    return output;
}

exports.inflate = inflate$1;
exports.deflate = deflate$1;

var zlibes = (function (exports) {
    'use strict';

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
    function generateDeflateHuffmanTable(values) {
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
            for (let i = 0; i < 15; i++) {
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

    function generateLZ77CodeValues(input) {
        const lengthCodeValues = [256];
        const distanceCodeValues = [];
        const inputLen = input.length;
        let slideIndexBase = 0;
        let slideIndex = 0;
        let nowIndex = 0;
        let repeatLength = 0;
        let repeatLengthMax = 0;
        let repeatLengthMaxIndex = 0;
        let distance = 0;
        let repeatLengthCodeValue = 0;
        let repeatDistanceCodeValue = 0;
        let repeatLengthCodeValueMax = 256;
        let repeatDistanceCodeValueMax = 0;
        while (nowIndex < inputLen) {
            slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0;
            slideIndex = 0;
            repeatLength = 0;
            repeatLengthMax = 0;
            while (slideIndexBase + slideIndex < nowIndex) {
                repeatLength = 0;
                while (input[slideIndexBase + slideIndex + repeatLength] === input[nowIndex + repeatLength]) {
                    repeatLength++;
                }
                if (repeatLengthMax < repeatLength) {
                    repeatLengthMax = repeatLength;
                    repeatLengthMaxIndex = slideIndexBase + slideIndex;
                }
                slideIndex++;
            }
            if (repeatLengthMax >= 3) {
                distance = nowIndex - repeatLengthMaxIndex;
                for (let i = 0; LENGTH_EXTRA_BIT_BASE.length; i++) {
                    if (LENGTH_EXTRA_BIT_BASE[i] > repeatLengthMax) {
                        break;
                    }
                    repeatLengthCodeValue = i;
                }
                repeatLengthCodeValue += 257;
                lengthCodeValues.push(repeatLengthCodeValue);
                if (repeatLengthCodeValueMax < repeatLengthCodeValue) {
                    repeatLengthCodeValueMax = repeatLengthCodeValue;
                }
                for (let i = 0; DISTANCE_EXTRA_BIT_BASE.length; i++) {
                    if (DISTANCE_EXTRA_BIT_BASE[i] > distance) {
                        break;
                    }
                    repeatDistanceCodeValue = i;
                }
                distanceCodeValues.push(repeatDistanceCodeValue);
                if (repeatDistanceCodeValueMax < repeatDistanceCodeValue) {
                    repeatDistanceCodeValueMax = repeatDistanceCodeValue;
                }
                nowIndex += repeatLengthMax;
            }
            else {
                lengthCodeValues.push(input[nowIndex]);
                nowIndex++;
            }
        }
        return {
            repeatLengthCodeValueMax,
            repeatDistanceCodeValueMax,
            lengthCodeValues,
            distanceCodeValues,
        };
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
        const streamHeap = (input.length < BLOCK_MAX_BUFFER_LEN / 2) ? BLOCK_MAX_BUFFER_LEN : input.length * 2;
        const stream = new BitWriteStream(new Uint8Array(streamHeap));
        stream.writeRange(1, 1);
        stream.writeRange(BTYPE.DYNAMIC, 2);
        deflateDynamicBlock(stream, input);
        if (stream.nowBitsIndex !== 0) {
            stream.writeRange(0, 8 - stream.nowBitsIndex);
        }
        return stream.buffer.subarray(0, stream.bufferIndex);
    }
    function deflateDynamicBlock(stream, input) {
        const inputLen = input.length;
        const lz77CodeValuesObj = generateLZ77CodeValues(input);
        const dataHuffmanTables = generateDeflateHuffmanTable(lz77CodeValuesObj.lengthCodeValues);
        const distanceHuffmanTables = generateDeflateHuffmanTable(lz77CodeValuesObj.distanceCodeValues);
        const codelens = [];
        for (let i = 0; i <= lz77CodeValuesObj.repeatLengthCodeValueMax; i++) {
            if (dataHuffmanTables.has(i)) {
                codelens.push(dataHuffmanTables.get(i).bitlen);
            }
            else {
                codelens.push(0);
            }
        }
        const HLIT = codelens.length;
        for (let i = 0; i <= lz77CodeValuesObj.repeatDistanceCodeValueMax; i++) {
            if (distanceHuffmanTables.has(i)) {
                codelens.push(distanceHuffmanTables.get(i).bitlen);
            }
            else {
                codelens.push(0);
            }
        }
        const HDIST = codelens.length - HLIT;
        // ランレングス符号化
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
                    runLengthCodes.push(codelen); // TODO:
                    runLengthRepeatCount.push(1); // TODO:
                    repeatLength--; // TODO:
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
        const codelenHuffmanTable = generateDeflateHuffmanTable(runLengthCodes);
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
        let slideIndexBase = 0;
        let slideIndex = 0;
        let nowIndex = 0;
        repeatLength = 0;
        let repeatLengthMax = 0;
        let repeatLengthMaxIndex = 0;
        let distance = 0;
        let repeatLengthCodeValue = 0;
        let repeatDistanceCodeValue = 0;
        while (nowIndex < inputLen) {
            slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0;
            slideIndex = 0;
            repeatLength = 0;
            repeatLengthMax = 0;
            while (slideIndexBase + slideIndex < nowIndex) {
                repeatLength = 0;
                while (input[slideIndexBase + slideIndex + repeatLength] === input[nowIndex + repeatLength]) {
                    repeatLength++;
                }
                if (repeatLengthMax < repeatLength) {
                    repeatLengthMax = repeatLength;
                    repeatLengthMaxIndex = slideIndexBase + slideIndex;
                }
                slideIndex++;
            }
            if (repeatLengthMax >= 3) {
                distance = nowIndex - repeatLengthMaxIndex;
                for (let i = 0; LENGTH_EXTRA_BIT_BASE.length; i++) {
                    if (LENGTH_EXTRA_BIT_BASE[i] > repeatLengthMax) {
                        break;
                    }
                    repeatLengthCodeValue = i;
                }
                codelenTableObj = dataHuffmanTables.get(repeatLengthCodeValue + 257);
                if (codelenTableObj === undefined) {
                    throw new Error('Data is corrupted');
                }
                stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
                if (0 < LENGTH_EXTRA_BIT_LEN[repeatLengthCodeValue]) {
                    stream.writeRange(repeatLengthMax - LENGTH_EXTRA_BIT_BASE[repeatLengthCodeValue], LENGTH_EXTRA_BIT_LEN[repeatLengthCodeValue]);
                }
                for (let i = 0; DISTANCE_EXTRA_BIT_BASE.length; i++) {
                    if (DISTANCE_EXTRA_BIT_BASE[i] > distance) {
                        break;
                    }
                    repeatDistanceCodeValue = i;
                }
                const distanceTableObj = distanceHuffmanTables.get(repeatDistanceCodeValue);
                if (distanceTableObj === undefined) {
                    throw new Error('Data is corrupted');
                }
                stream.writeRangeCoded(distanceTableObj.code, distanceTableObj.bitlen);
                if (0 < DISTANCE_EXTRA_BIT_LEN[repeatDistanceCodeValue]) {
                    stream.writeRange(distance - DISTANCE_EXTRA_BIT_BASE[repeatDistanceCodeValue], DISTANCE_EXTRA_BIT_LEN[repeatDistanceCodeValue]);
                }
                nowIndex += repeatLengthMax;
            }
            else {
                codelenTableObj = dataHuffmanTables.get(input[nowIndex]);
                if (codelenTableObj === undefined) {
                    throw new Error('Data is corrupted');
                }
                stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
                nowIndex++;
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
        const stream = new BitReadStream(input, offset);
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
                repeatLengthValue += stream.readRange(repeatLengthExt);
            }
            repeatDistanceCode = stream.readRangeCoded(5);
            repeatDistanceValue = DISTANCE_EXTRA_BIT_BASE[repeatDistanceCode];
            repeatDistanceExt = DISTANCE_EXTRA_BIT_LEN[repeatDistanceCode];
            if (0 < repeatDistanceExt) {
                repeatDistanceValue += stream.readRange(repeatDistanceExt);
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
                repeatLengthValue += stream.readRange(repeatLengthExt);
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
                repeatDistanceValue += stream.readRange(repeatDistanceExt);
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

    return exports;

}({}));

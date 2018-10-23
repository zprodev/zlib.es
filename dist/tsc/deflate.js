import { BLOCK_MAX_BUFFER_LEN, BTYPE, CODELEN_VALUES, DISTANCE_EXTRA_BIT_BASE, DISTANCE_EXTRA_BIT_LEN, LENGTH_EXTRA_BIT_BASE, LENGTH_EXTRA_BIT_LEN, } from './const';
import { generateDeflateHuffmanTable } from './huffman';
import { generateLZ77Codes } from './lz77';
import { BitWriteStream } from './utils/BitWriteStream';
export function deflate(input) {
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
function deflateUncompressedBlock(stream, input, inputIndex) {
    stream.writeRange(0, 5);
    const LEN = (input.length - inputIndex > 0xffff) ? 0xffff : input.length;
    const NLEN = 0xffff - LEN;
    stream.writeRange(LEN & 0xff, 8);
    stream.writeRange(LEN >> 8, 8);
    stream.writeRange(NLEN & 0xff, 8);
    stream.writeRange(NLEN >> 8, 8);
    for (let i = 0; i < LEN; i++) {
        stream.writeRange(input[inputIndex], 8);
        inputIndex++;
    }
    return inputIndex;
}
function deflateDynamicBlock(stream, input) {
    const lz77Codes = generateLZ77Codes(input);
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

import {
  BLOCK_MAX_BUFFER_LEN,
  BTYPE,
  CODELEN_VALUES,
  DISTANCE_EXTRA_BIT_BASE,
  DISTANCE_EXTRA_BIT_LEN,
  LENGTH_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_LEN,
} from './const';
import {generateDeflateHuffmanTable} from './huffman';
import {generateLZ77Codes} from './lz77';
import {BitWriteStream} from './utils/BitWriteStream';

export function deflate(input: Uint8Array) {
  const inputLength = input.length;
  const streamHeap = (inputLength < BLOCK_MAX_BUFFER_LEN / 2) ? BLOCK_MAX_BUFFER_LEN : inputLength * 2;
  const stream = new BitWriteStream( new Uint8Array(streamHeap) );
  let processedLength = 0;
  let targetLength = 0;
  while (true) {
    if (processedLength + BLOCK_MAX_BUFFER_LEN >= inputLength) {
      targetLength = inputLength - processedLength;
      stream.writeRange(1, 1);
    } else {
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

function deflateUncompressedBlock(stream: BitWriteStream, input: Uint8Array, inputIndex: number) {
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

function deflateDynamicBlock(stream: BitWriteStream, input: Uint8Array, startIndex: number, targetLength: number) {
  const lz77Codes = generateLZ77Codes(input, startIndex, targetLength);
  const clCodeValues: number[] = [256];  // character or matching length
  const distanceCodeValues: number[] = [];
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

  const codelens: number[] = [];
  for (let i = 0; i <= clCodeValueMax; i++) {
    if (dataHuffmanTables.has(i)) {
      codelens.push((dataHuffmanTables.get(i) as any).bitlen);
    } else {
      codelens.push(0);
    }
  }
  const HLIT = codelens.length;
  for (let i = 0; i <= distanceCodeValueMax; i++) {
    if (distanceHuffmanTables.has(i)) {
      codelens.push((distanceHuffmanTables.get(i) as any).bitlen);
    } else {
      codelens.push(0);
    }
  }
  const HDIST = codelens.length - HLIT;

  const runLengthCodes: number[] = [];
  const runLengthRepeatCount: number[] = [];
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
      } else {
        if (6 <= repeatLength) {
          break;
        }
      }
    }
    if (4 <= repeatLength) {
      if (codelen === 0) {
        if (11 <= repeatLength) {
          runLengthCodes.push(18);
        } else {
          runLengthCodes.push(17);
        }
      } else {
        runLengthCodes.push(codelen);
        runLengthRepeatCount.push(1);
        repeatLength--;
        runLengthCodes.push(16);
      }
      runLengthRepeatCount.push(repeatLength);
    } else {
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
  let codelenTableObj: {code: number, bitlen: number} | undefined;
  // codelenHuffmanTable
  for (let i = 0; i < HCLEN; i++) {
    codelenTableObj = codelenHuffmanTable.get(CODELEN_VALUES[i]);
    if (codelenTableObj !== undefined) {
      stream.writeRange(codelenTableObj.bitlen, 3);
    } else {
      stream.writeRange(0, 3);
    }
  }

  runLengthCodes.forEach((value, index) => {
    codelenTableObj = codelenHuffmanTable.get(value);
    if (codelenTableObj !== undefined) {
      stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
    } else {
      throw new Error('Data is corrupted');
    }
    if (value === 18) {
      stream.writeRange(runLengthRepeatCount[index] - 11, 7);
    } else if (value === 17) {
      stream.writeRange(runLengthRepeatCount[index] - 3, 3);
    } else if (value === 16) {
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
        stream.writeRange(
          repeatLength - LENGTH_EXTRA_BIT_BASE[clCodeValue],
          LENGTH_EXTRA_BIT_LEN[clCodeValue],
        );
      }
      const distanceTableObj = distanceHuffmanTables.get(distanceCodeValue);
      if (distanceTableObj === undefined) {
        throw new Error('Data is corrupted');
      }
      stream.writeRangeCoded(distanceTableObj.code, distanceTableObj.bitlen);

      if (0 < DISTANCE_EXTRA_BIT_LEN[distanceCodeValue]) {
        const distance = values[3];
        stream.writeRange(
          distance - DISTANCE_EXTRA_BIT_BASE[distanceCodeValue],
          DISTANCE_EXTRA_BIT_LEN[distanceCodeValue],
        );
      }
    } else {
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

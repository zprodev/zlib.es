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
import {generateLZ77CodeValues, generateLZ77IndexMap} from './lz77';
import {BitWriteStream} from './utils/BitWriteStream';

export function deflate(input: Uint8Array) {
  const streamHeap = (input.length < BLOCK_MAX_BUFFER_LEN / 2) ? BLOCK_MAX_BUFFER_LEN : input.length * 2;
  const stream = new BitWriteStream( new Uint8Array(streamHeap) );
  stream.writeRange(1, 1);
  stream.writeRange(BTYPE.DYNAMIC, 2);
  deflateDynamicBlock(stream, input);
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

function deflateDynamicBlock(stream: BitWriteStream, input: Uint8Array) {
  const inputLen = input.length;
  const lz77IndexMap = generateLZ77IndexMap(input);
  const lz77CodeValuesObj = generateLZ77CodeValues(input, lz77IndexMap);
  const dataHuffmanTables = generateDeflateHuffmanTable(lz77CodeValuesObj.lengthCodeValues);
  const distanceHuffmanTables = generateDeflateHuffmanTable(lz77CodeValuesObj.distanceCodeValues);

  const codelens: number[] = [];
  for (let i = 0; i <= lz77CodeValuesObj.repeatLengthCodeValueMax; i++) {
    if (dataHuffmanTables.has(i)) {
      codelens.push((dataHuffmanTables.get(i) as any).bitlen);
    } else {
      codelens.push(0);
    }
  }
  const HLIT = codelens.length;
  for (let i = 0; i <= lz77CodeValuesObj.repeatDistanceCodeValueMax; i++) {
    if (distanceHuffmanTables.has(i)) {
      codelens.push((distanceHuffmanTables.get(i) as any).bitlen);
    } else {
      codelens.push(0);
    }
  }
  const HDIST = codelens.length - HLIT;

  // ランレングス符号化
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
  let slideIndexBase = 0;
  let nowIndex = 0;
  repeatLength = 0;
  let repeatLengthMax = 0;
  let repeatLengthMaxIndex = 0;
  let distance = 0;
  let repeatLengthCodeValue = 0;
  let repeatDistanceCodeValue = 0;

  while (nowIndex < inputLen) {
    slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0 ;
    repeatLength = 0;
    repeatLengthMax = 0;
    const indexes = lz77IndexMap[
      input[nowIndex] << 16 | input[nowIndex + 1] << 8 | input[nowIndex + 2]
    ];
    if (indexes === undefined) {
      codelenTableObj = dataHuffmanTables.get(input[nowIndex]);
      if (codelenTableObj === undefined) {
        throw new Error('Data is corrupted');
      }
      stream.writeRangeCoded(codelenTableObj.code, codelenTableObj.bitlen);
      nowIndex++;
      continue;
    }
    for (let i = 0, iMax = indexes.length; i < iMax; i++) {
      if (slideIndexBase <= indexes[i] && indexes[i] < nowIndex ) {
        repeatLength = 0;
        while (input[indexes[i] + repeatLength] === input[nowIndex + repeatLength]) {
          repeatLength++;
          if (257 < repeatLength) {
            break;
          }
        }
        if (repeatLengthMax < repeatLength) {
          repeatLengthMax = repeatLength;
          repeatLengthMaxIndex = indexes[i];
        }
      }
    }
    if (repeatLengthMax >= 3) {
      distance = nowIndex - repeatLengthMaxIndex;
      for (let i = 0; i < LENGTH_EXTRA_BIT_BASE.length; i++) {
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
        stream.writeRange(
          repeatLengthMax - LENGTH_EXTRA_BIT_BASE[repeatLengthCodeValue],
          LENGTH_EXTRA_BIT_LEN[repeatLengthCodeValue],
        );
      }

      for (let i = 0; i < DISTANCE_EXTRA_BIT_BASE.length; i++) {
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
        stream.writeRange(
          distance - DISTANCE_EXTRA_BIT_BASE[repeatDistanceCodeValue],
          DISTANCE_EXTRA_BIT_LEN[repeatDistanceCodeValue],
        );
      }

      nowIndex += repeatLengthMax;
    } else {
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

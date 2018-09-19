import {
  BLOCK_MAX_BUFFER_LEN,
  BTYPE,
  CODELEN_VALUES,
  DISTANCE_EXTRA_BIT_BASE,
  DISTANCE_EXTRA_BIT_LEN,
  LENGTH_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_LEN,
} from './const';
import {generateHuffmanTable, makeFixedHuffmanCodelenValues} from './huffman';
import {BitStream} from './utils/BitStream';

const FIXED_HUFFMAN_TABLE = generateHuffmanTable( makeFixedHuffmanCodelenValues() );

export function inflate(input: Uint8Array, offset: number = 0) {
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
    } else if (bType === BTYPE.FIXED) {
      bufferIndex = inflateFixedBlock(stream, buffer, bufferIndex);
    } else if (bType === BTYPE.DYNAMIC) {
      bufferIndex = inflateDynamicBlock(stream, buffer, bufferIndex);
    } else {
      throw new Error('Not supported BTYPE : ' + bType);
    }
    if (bFinal === 0 && stream.isEnd) {
      throw new Error('Data length is insufficient');
    }
  }

  return buffer.subarray(0, bufferIndex);
}

function inflateUncompressedBlock(stream: BitStream, buffer: Uint8Array, bufferIndex: number) {
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

function inflateFixedBlock(stream: BitStream, buffer: Uint8Array, bufferIndex: number) {
  const tables = FIXED_HUFFMAN_TABLE;

  const codelens = tables.keys();
  let iteratorResult = codelens.next();
  let codelen = 0;
  let codelenMax = 0;
  let codelenMin = Number.MAX_SAFE_INTEGER;
  while (!iteratorResult.done) {
    codelen = iteratorResult.value;
    if (codelenMax < codelen) { codelenMax = codelen; }
    if (codelenMin > codelen) { codelenMin = codelen; }
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
      table = tables.get(codelen) as Map<number, number>;
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

function inflateDynamicBlock(stream: BitStream, buffer: Uint8Array, bufferIndex: number) {
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
    if (codelenCodelenMax < codelenCodelen) { codelenCodelenMax = codelenCodelen; }
    if (codelenCodelenMin > codelenCodelen) { codelenCodelenMin = codelenCodelen; }
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
      codelenHuffmanTable = codelenHuffmanTables.get(codelenCodelen) as Map<number, number>;
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
    } else if (runlengthCode === 17) {
      repeat = 3 + stream.readRange(3);
      codelen = 0;
    } else if (runlengthCode === 18) {
      repeat = 11 + stream.readRange(7);
      codelen = 0;
    } else {
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
      } else {
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
    if (dataCodelenMax < dataCodelen) { dataCodelenMax = dataCodelen; }
    if (dataCodelenMin > dataCodelen) { dataCodelenMin = dataCodelen; }
    dataCodelensIteratorResult = dataCodelens.next();
  }

  const distanceCodelens = distanceHuffmanTables.keys();
  let distanceCodelensIteratorResult = distanceCodelens.next();
  let distanceCodelen = 0;
  let distanceCodelenMax = 0;
  let distanceCodelenMin = Number.MAX_SAFE_INTEGER;
  while (!distanceCodelensIteratorResult.done) {
    distanceCodelen = distanceCodelensIteratorResult.value;
    if (distanceCodelenMax < distanceCodelen) { distanceCodelenMax = distanceCodelen; }
    if (distanceCodelenMin > distanceCodelen) { distanceCodelenMin = distanceCodelen; }
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
      dataHuffmanTable = dataHuffmanTables.get(dataCodelen) as Map<number, number>;
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
      distanceHuffmanTable = distanceHuffmanTables.get(repeatDistanceCodeCodelen) as Map<number, number>;
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

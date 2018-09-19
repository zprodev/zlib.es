import {
  BLOCK_MAX_BUFFER_LEN,
  BTYPE,
  CODELEN_VALUES,
  DISTANCE_EXTRA_BIT_BASE,
  DISTANCE_EXTRA_BIT_LEN,
  LENGTH_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_LEN,
} from './const';
import {BitWriteStream} from './utils/BitWriteStream';

export function deflate(input: Uint8Array) {
  let inputIndex = 0;
  let stream = new BitWriteStream( new Uint8Array(BLOCK_MAX_BUFFER_LEN) );
  while (inputIndex < input.length) {
    if (stream.buffer.length < stream.bufferIndex + BLOCK_MAX_BUFFER_LEN) {
      const newBuffer = new Uint8Array(stream.buffer.length + BLOCK_MAX_BUFFER_LEN);
      newBuffer.set(stream.buffer);
      stream = new BitWriteStream( newBuffer, stream.bufferIndex, stream.nowBitsIndex );
    }
    if (input.length - inputIndex <= 0xffff) {
      stream.writeRange(1, 1);
    } else {
      stream.writeRange(0, 1);
    }
    stream.writeRange(0, 2);
    inputIndex = deflateUncompressedBlock(stream, input, inputIndex);
  }
  const writeLen = (stream.nowBitsIndex === 0) ? stream.bufferIndex : stream.bufferIndex + 1;
  return stream.buffer.subarray(0, writeLen);
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

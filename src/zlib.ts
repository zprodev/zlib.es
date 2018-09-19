import {calcAdler32} from './adler32';
import {deflate as deflateCore} from './deflate';
import {inflate as inflateCore} from './inflate';
import {BitReadStream} from './utils/BitReadStream';
import {BitWriteStream} from './utils/BitWriteStream';

export function inflate(input: Uint8Array) {
  const stream = new BitReadStream(input);
  const CM = stream.readRange(4);
  if (CM !== 8) {
    throw new Error('Not compressed by deflate');
  }
  const CINFO = stream.readRange(4);
  const FCHECK = stream.readRange(5);
  const FDICT = stream.readRange(1);
  const FLEVEL = stream.readRange(2);

  return inflateCore(input, 2);
}

export function deflate(input: Uint8Array) {
  const data = deflateCore(input);

  const CMF = new BitWriteStream( new Uint8Array(1) );
  CMF.writeRange(8, 4);
  CMF.writeRange(7, 4);
  const FLG = new BitWriteStream( new Uint8Array(1) );
  FLG.writeRange(28, 5);
  FLG.writeRange(0, 1);
  FLG.writeRange(2, 2);
  const ADLER32 = new BitWriteStream( new Uint8Array(4) );
  const adler32 = calcAdler32(input);
  ADLER32.writeRange(adler32 >>> 24, 8);
  ADLER32.writeRange((adler32 >>> 16) & 0xff, 8);
  ADLER32.writeRange((adler32 >>> 8) & 0xff, 8);
  ADLER32.writeRange(adler32 & 0xff, 8);

  const output = new Uint8Array(data.length + 6);
  output.set(CMF.buffer);
  output.set(FLG.buffer, 1);
  output.set(data, 2);
  output.set(ADLER32.buffer, output.length - 4 );

  return output;
}

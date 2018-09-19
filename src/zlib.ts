import {inflate as inflateCore} from './inflate';
import {BitStream} from './utils/BitStream';

export function inflate(input: Uint8Array) {
  const stream = new BitStream(input);
  const CM = stream.readRange(4);
  const CINFO = stream.readRange(4);
  const FCHECK = stream.readRange(5);
  const FDICT = stream.readRange(1);
  const FLEVEL = stream.readRange(2);

  return inflateCore(input, 2);
}

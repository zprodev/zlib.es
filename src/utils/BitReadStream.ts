export class BitReadStream {
  public buffer: Uint8Array;
  public bufferIndex: number;
  public nowBits: number;
  public nowBitsLength = 0;
  public isEnd = false;
  constructor(buffer: Uint8Array, offset: number = 0) {
    this.buffer = buffer;
    this.bufferIndex = offset;
    this.nowBits = buffer[offset];
    this.nowBitsLength = 8;
  }

  public read() {
    if (this.isEnd) { throw new Error('Lack of data length'); }
    const bit = this.nowBits & 1;
    if (this.nowBitsLength > 1) {
      this.nowBitsLength--;
      this.nowBits >>= 1;
    } else {
      this.bufferIndex++;
      if (this.bufferIndex < this.buffer.length) {
        this.nowBits = this.buffer[this.bufferIndex];
        this.nowBitsLength = 8;
      } else {
        this.nowBitsLength = 0;
        this.isEnd = true;
      }
    }
    return bit;
  }
  public readRange(length: number) {
    while (this.nowBitsLength <= length) {
      this.nowBits |= this.buffer[++this.bufferIndex] << this.nowBitsLength;
      this.nowBitsLength += 8;
    }
    const bits = this.nowBits & ((1 << length) - 1);
    this.nowBits >>>= length;
    this.nowBitsLength -= length;
    return bits;
  }
  public readRangeCoded(length: number) {
    let bits = 0;
    for (let i = 0; i < length; i++) {
      bits <<= 1;
      bits |= this.read();
    }
    return bits;
  }
}

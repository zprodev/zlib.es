export class BitReadStream {
  public buffer: Uint8Array;
  public bufferIndex: number;
  public nowBits: number;
  public nowBitsIndex = 0;
  public isEnd = false;
  constructor(buffer: Uint8Array, offset: number = 0) {
    this.buffer = buffer;
    this.bufferIndex = offset;
    this.nowBits = buffer[offset];
  }

  public read() {
    if (this.isEnd) { throw new Error('Lack of data length'); }
    const bit = this.nowBits & 1;
    if (this.nowBitsIndex < 7) {
      this.nowBitsIndex++;
      this.nowBits >>= 1;
    } else {
      this.bufferIndex++;
      this.nowBitsIndex = 0;
      if (this.bufferIndex < this.buffer.length) {
        this.nowBits = this.buffer[this.bufferIndex];
      } else {
        this.isEnd = true;
      }
    }
    return bit;
  }
  public readRange(length: number) {
    let bits = 0;
    for (let i = 0; i < length; i++) {
      bits |= this.read() << i;
    }
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

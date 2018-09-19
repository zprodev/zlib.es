export class BitWriteStream {
  public buffer: Uint8Array;
  public bufferIndex: number;
  public nowBits: number;
  public nowBitsIndex = 0;
  public isEnd = false;
  constructor(buffer: Uint8Array, bufferOffset: number = 0, bitsOffset: number = 0) {
    this.buffer = buffer;
    this.bufferIndex = bufferOffset;
    this.nowBits = buffer[bufferOffset];
    this.nowBitsIndex = bitsOffset;
  }

  public write(bit: number) {
    if (this.isEnd) { throw new Error('Lack of data length'); }
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
  public writeRange(value: number, length: number) {
    let mask = 1;
    let bit = 0;
    for (let i = 0; i < length; i++) {
      bit = (value & mask) ? 1 : 0;
      this.write(bit);
      mask <<= 1;
    }
  }
  public writeRangeCoded(value: number, length: number) {
    let mask = 1 << (length - 1);
    let bit = 0;
    for (let i = 0; i < length; i++) {
      bit = (value & mask) ? 1 : 0;
      this.write(bit);
      mask >>>= 1;
    }
  }
}

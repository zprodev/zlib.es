export class BitWriteStream {
    constructor(buffer, bufferOffset = 0, bitsOffset = 0) {
        this.nowBitsIndex = 0;
        this.isEnd = false;
        this.buffer = buffer;
        this.bufferIndex = bufferOffset;
        this.nowBits = buffer[bufferOffset];
        this.nowBitsIndex = bitsOffset;
    }
    write(bit) {
        if (this.isEnd) {
            throw new Error('Lack of data length');
        }
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
    writeRange(value, length) {
        let mask = 1;
        let bit = 0;
        for (let i = 0; i < length; i++) {
            bit = (value & mask) ? 1 : 0;
            this.write(bit);
            mask <<= 1;
        }
    }
    writeRangeCoded(value, length) {
        let mask = 1 << (length - 1);
        let bit = 0;
        for (let i = 0; i < length; i++) {
            bit = (value & mask) ? 1 : 0;
            this.write(bit);
            mask >>>= 1;
        }
    }
}

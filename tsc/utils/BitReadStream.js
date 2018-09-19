export class BitReadStream {
    constructor(buffer, offset = 0) {
        this.nowBitsIndex = 0;
        this.isEnd = false;
        this.buffer = buffer;
        this.bufferIndex = offset;
        this.nowBits = buffer[offset];
    }
    read() {
        if (this.isEnd) {
            throw new Error('Lack of data length');
        }
        const bit = this.nowBits & 1;
        if (this.nowBitsIndex < 7) {
            this.nowBitsIndex++;
            this.nowBits >>= 1;
        }
        else {
            this.bufferIndex++;
            this.nowBitsIndex = 0;
            if (this.bufferIndex < this.buffer.length) {
                this.nowBits = this.buffer[this.bufferIndex];
            }
            else {
                this.isEnd = true;
            }
        }
        return bit;
    }
    readRange(length) {
        let bits = 0;
        for (let i = 0; i < length; i++) {
            bits |= this.read() << i;
        }
        return bits;
    }
    readRangeCoded(length) {
        let bits = 0;
        for (let i = 0; i < length; i++) {
            bits <<= 1;
            bits |= this.read();
        }
        return bits;
    }
}

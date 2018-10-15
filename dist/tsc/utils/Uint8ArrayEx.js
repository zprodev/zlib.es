export class Uint8ArrayEx {
    constructor(size) {
        this._maxSize = 0;
        this._extendedSize = 0;
        this._nowIndex = 0;
        this._buffer = new Uint8Array(size);
        this._extendedSize = size;
        this._maxSize = size;
    }
    set(value) {
        if (this._maxSize < this._nowIndex) {
            this._maxSize += this._extendedSize;
            const newBuffer = new Uint8Array(this._maxSize);
            const nowSize = this._buffer.length;
            for (let i = 0; i < nowSize; i++) {
                newBuffer[i] = this._buffer[i];
            }
            this._buffer = newBuffer;
        }
        this._buffer[this._nowIndex] = value;
        this._nowIndex++;
    }
    get index() {
        return this._nowIndex;
    }
    get length() {
        return this._maxSize;
    }
    get data() {
        return this._buffer;
    }
}

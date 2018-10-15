export class Uint8WriteStream {
  public index = 0;
  public buffer: Uint8Array;
  public length: number;
  private _extendedSize: number;

  constructor(extendedSize: number) {
    this.buffer = new Uint8Array(extendedSize);
    this.length = extendedSize;
    this._extendedSize = extendedSize;
  }
  public write(value: number) {
    if (this.length <= this.index) {
      this.length += this._extendedSize;
      const newBuffer = new Uint8Array(this.length);
      const nowSize = this.buffer.length;
      for (let i = 0; i < nowSize; i++) {
        newBuffer[i] = this.buffer[i];
      }
      this.buffer = newBuffer;
    }
    this.buffer[this.index] = value;
    this.index++;
  }
}

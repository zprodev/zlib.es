# zlib.es

ECMAScript compliant lightweight zlib implementation

## Distribution

### npm

```
npm i zlib.es
```

### files

[for browser](https://github.com/zprodev/zlib.es/tree/master/dist/browser)

[for CommonJS](https://github.com/zprodev/zlib.es/tree/master/dist/cjs)

[for ESModules](https://github.com/zprodev/zlib.es/tree/master/dist/esm)

## Usage

### compression

```
import { deflate } from 'zlib.es';

const compressedData = deflate(rawData); // Input type is Uint8Array
```

### decompression

```
import { inflate } from 'zlib.es';

const rawData = inflate(compressedData);
```

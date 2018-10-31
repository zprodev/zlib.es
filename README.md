# zlib.es

[![Build Status](https://travis-ci.org/zprodev/zlib.es.svg?branch=master)](https://travis-ci.org/zprodev/zlib.es)
[![npm](https://img.shields.io/npm/v/zlib.es.svg)](https://www.npmjs.com/package/zlib.es)
[![license](https://img.shields.io/github/license/zprodev/zlib.es.svg)](LICENSE)

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

const assert = require('assert');
const zlibes = require('../dist/cjs/zlib');
const nodeZlib = require('zlib');
const fs = require('fs');
const path = require('path');

const RAW           = new Uint8Array([84, 104, 105, 115, 32, 105, 115, 32, 122, 108, 105, 98, 46, 101, 115]);
const UNCOMPRESSED  = new Uint8Array([120, 156, 1, 15, 0, 240, 255, 84, 104, 105, 115, 32, 105, 115, 32, 122, 108, 105, 98, 46, 101, 115, 43, 35, 5, 108]);
const FIXED         = new Uint8Array([120, 156, 11, 201, 200, 44, 86, 0, 162, 170, 156, 204, 36, 189, 212, 98, 0, 43, 35, 5, 108]);
const DYNAMIC       = new Uint8Array([120, 156, 13, 194, 65, 9, 0, 0, 8, 3, 192, 42, 38, 48, 141, 9, 4, 193, 129, 191, 253, 150, 126, 194, 213, 130, 241, 116, 232, 28, 26, 43, 35, 5, 108]);

const RAW_BIN = fs.readFileSync(path.join(__dirname, 'data', 'raw.bin'));
const CMP_BIN = fs.readFileSync(path.join(__dirname, 'data', 'compressed.bin'));

describe('inflate', function() {
  it('UNCOMPRESSED', function() {
    assert.deepEqual(
      RAW,
      zlibes.inflate(UNCOMPRESSED)
    );
  });

  it('FIXED', function() {
    assert.deepEqual(
      RAW,
      zlibes.inflate(FIXED)
    );
  });

  it('DYNAMIC', function() {
    assert.deepEqual(
      RAW,
      zlibes.inflate(DYNAMIC)
    );
  });

  it('binary data', function() {
    assert.deepEqual(
      RAW_BIN,
      zlibes.inflate(CMP_BIN)
    );
  });
});

describe('deflate', function() {
  describe('Execution', function() {
    it('RAW', function() {
      zlibes.deflate(RAW);
      assert.ok(true);
    });
    it('binary data', function() {
      zlibes.deflate(RAW_BIN);
      assert.ok(true);
    });
  });
  describe('Validation', function() {
    describe('RAW', function() {
      const deflateOutput = zlibes.deflate(RAW);
      it('zlib.es', function() {
        assert.deepEqual(
          RAW,
          zlibes.inflate(deflateOutput)
        );
      });
      it('Node.js', function() {
        assert.deepEqual(
          RAW,
          nodeZlib.inflateSync(deflateOutput)
        );
      });
    });
    describe('binary data', function() {
      const deflateOutput = zlibes.deflate(RAW_BIN);
      it('zlib.es', function() {
        assert.deepEqual(
          RAW_BIN,
          zlibes.inflate(deflateOutput)
        );
      });
      it('Node.js', function() {
        assert.deepEqual(
          RAW_BIN,
          nodeZlib.inflateSync(deflateOutput)
        );
      });
    });
  
    describe('Repeat Length Limit', function() {
      const ascii = '!"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
      let asciiRepeat = '';
      while(asciiRepeat.length < 1000){
        asciiRepeat += ascii;
      }
      const deflateInput = new Uint8Array(new Buffer(asciiRepeat));
      const deflateOutput = zlibes.deflate(deflateInput);
      it('zlib.es', function() {
        assert.deepEqual(
          deflateInput,
          zlibes.inflate(deflateOutput)
        );
      });
      it('Node.js', function() {
        assert.deepEqual(
          deflateInput,
          nodeZlib.inflateSync(deflateOutput)
        );
      });
    });
  });
});

import {
  DISTANCE_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_BASE,
} from './const';

const REPEAT_LEN_MIN = 3;
const FAST_INDEX_CHECK_MAX = 128;
const FAST_INDEX_CHECK_MIN = 16;
const FAST_REPEAT_LENGTH = 8;

function generateLZ77IndexMap(input: Uint8Array) {
  const end = input.length - REPEAT_LEN_MIN;
  const indexMap: {[key: number]: number[]} = {};
  for (let i = 0; i <= end; i++) {
    const indexKey = input[i] << 16 | input[i + 1] << 8 | input[i + 2];
    if (indexMap[indexKey] === undefined) {
      indexMap[indexKey] = [];
    }
    indexMap[indexKey].push(i);
  }
  return indexMap;
}

export function generateLZ77Codes(input: Uint8Array) {
  const inputLen = input.length;
  let nowIndex = 0;
  let slideIndexBase = 0;
  let repeatLength = 0;
  let repeatLengthMax = 0;
  let repeatLengthMaxIndex = 0;
  let distance = 0;
  let repeatLengthCodeValue = 0;
  let repeatDistanceCodeValue = 0;
  const codeTargetValues = [];
  const startIndexMap: {[key: number]: number} = {};
  const endIndexMap: {[key: number]: number} = {};
  const indexMap = generateLZ77IndexMap(input);
  while (nowIndex < inputLen) {
    const indexKey = input[nowIndex] << 16 | input[nowIndex + 1] << 8 | input[nowIndex + 2];
    const indexes = indexMap[
      indexKey
    ];
    if (indexes === undefined || indexes.length <= 1) {
      codeTargetValues.push([input[nowIndex]]);
      nowIndex++;
      continue;
    }
    slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0 ;
    repeatLengthMax = 0;
    repeatLengthMaxIndex = 0;

    let skipindexes = startIndexMap[indexKey] || 0;
    while (indexes[skipindexes] < slideIndexBase) {
      skipindexes = (skipindexes + 1) | 0;
    }
    startIndexMap[indexKey] = skipindexes;
    skipindexes = endIndexMap[indexKey] || 0;
    while (indexes[skipindexes] < nowIndex) {
      skipindexes = (skipindexes + 1) | 0;
    }
    endIndexMap[indexKey] = skipindexes;

    let checkCount = 0;
    indexMapLoop: for (let i = endIndexMap[indexKey] - 1, iMin = startIndexMap[indexKey]; iMin <= i; i--) {
      if (checkCount >= FAST_INDEX_CHECK_MAX
        || (repeatLengthMax >= FAST_REPEAT_LENGTH && checkCount >= FAST_INDEX_CHECK_MIN)) {
        break;
      }
      ++checkCount;
      const index = indexes[i];
      for (let j = repeatLengthMax - 1; 0 < j; j--) {
        if (input[index + j] !== input[nowIndex + j]) {
          continue indexMapLoop;
        }
      }

      repeatLength = 258;

      for (let j = repeatLengthMax; j <= 258; j++) {
        if (input[index + j] !== input[nowIndex + j]) {
          repeatLength = j;
          break;
        }
      }
      if (repeatLengthMax < repeatLength) {
        repeatLengthMax = repeatLength;
        repeatLengthMaxIndex = index;
        if (258 <= repeatLength) {
          break;
        }
      }
    }
    if (repeatLengthMax >= 3) {
      distance = nowIndex - repeatLengthMaxIndex;
      for (let i = 0; i < LENGTH_EXTRA_BIT_BASE.length; i++) {
        if (LENGTH_EXTRA_BIT_BASE[i] > repeatLengthMax) {
          break;
        }
        repeatLengthCodeValue = i;
      }
      for (let i = 0; i < DISTANCE_EXTRA_BIT_BASE.length; i++) {
        if (DISTANCE_EXTRA_BIT_BASE[i] > distance) {
          break;
        }
        repeatDistanceCodeValue = i;
      }
      codeTargetValues.push([repeatLengthCodeValue, repeatDistanceCodeValue, repeatLengthMax, distance]);
      nowIndex += repeatLengthMax;
    } else {
      codeTargetValues.push([input[nowIndex]]);
      nowIndex++;
    }
  }
  return codeTargetValues;
}

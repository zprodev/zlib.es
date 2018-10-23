import {
  DISTANCE_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_BASE,
} from './const';

export const REPEAT_LEN_MIN = 3;

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
  const skipIndexMap: {[key: number]: number} = {};
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
    indexMapLoop: for (let i = skipIndexMap[indexKey] || 0, iMax = indexes.length; i < iMax; i++) {
      const index = indexes[i];
      if (nowIndex <= index) {
        break;
      }
      if (index < slideIndexBase) {
        skipIndexMap[indexKey] = i + 1;
        continue;
      }
      for (let j = repeatLengthMax - 1; 0 < j; j--) {
        if (input[index + j] !== input[nowIndex + j]) {
          continue indexMapLoop;
        }
      }
      repeatLength = repeatLengthMax;
      while (input[index + repeatLength] === input[nowIndex + repeatLength]) {
        repeatLength++;
        if (257 < repeatLength) {
          repeatLength = 258;
          break;
        }
      }
      if (repeatLengthMax <= repeatLength) {
        repeatLengthMax = repeatLength;
        repeatLengthMaxIndex = index;
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

import {
  DISTANCE_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_BASE,
} from './const';

export const REPEAT_LEN_MIN = 3;

export function generateLZ77IndexMap(input: Uint8Array) {
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

export function generateLZ77CodeValues(input: Uint8Array, indexMap: {[key: number]: number[]}) {
  const lengthCodeValues: number[] = [256];
  const distanceCodeValues: number[] = [];
  const inputLen = input.length;
  let slideIndexBase = 0;
  const slideIndex = 0;
  let nowIndex = 0;
  let repeatLength = 0;
  let repeatLengthMax = 0;
  let repeatLengthMaxIndex = 0;
  let distance = 0;
  let repeatLengthCodeValue = 0;
  let repeatDistanceCodeValue = 0;
  let repeatLengthCodeValueMax = 256;
  let repeatDistanceCodeValueMax = 0;

  while (nowIndex < inputLen) {
    slideIndexBase = (nowIndex > 0x8000) ? nowIndex - 0x8000 : 0 ;
    repeatLength = 0;
    repeatLengthMax = 0;

    const indexes = indexMap[
      input[nowIndex] << 16 | input[nowIndex + 1] << 8 | input[nowIndex + 2]
    ];
    if (indexes === undefined) {
      lengthCodeValues.push(input[nowIndex]);
      nowIndex++;
      continue;
    }
    indexes.forEach((hidIndex) => {
      if (slideIndexBase <= hidIndex && hidIndex < nowIndex ) {
        while (input[hidIndex + repeatLength] === input[nowIndex + repeatLength]) {
          repeatLength++;
          if (257 < repeatLength) {
            break;
          }
        }
        if (repeatLengthMax < repeatLength) {
          repeatLengthMax = repeatLength;
          repeatLengthMaxIndex = hidIndex;
        }
      }
    });
    if (repeatLengthMax >= 3) {
      distance = nowIndex - repeatLengthMaxIndex;
      for (let i = 0; i < LENGTH_EXTRA_BIT_BASE.length; i++) {
        if (LENGTH_EXTRA_BIT_BASE[i] > repeatLengthMax) {
          break;
        }
        repeatLengthCodeValue = i;
      }
      repeatLengthCodeValue += 257;
      lengthCodeValues.push(repeatLengthCodeValue);
      if (repeatLengthCodeValueMax < repeatLengthCodeValue) {
        repeatLengthCodeValueMax = repeatLengthCodeValue;
      }

      for (let i = 0; i < DISTANCE_EXTRA_BIT_BASE.length; i++) {
        if (DISTANCE_EXTRA_BIT_BASE[i] > distance) {
          break;
        }
        repeatDistanceCodeValue = i;
      }
      distanceCodeValues.push(repeatDistanceCodeValue);
      if (repeatDistanceCodeValueMax < repeatDistanceCodeValue) {
        repeatDistanceCodeValueMax = repeatDistanceCodeValue;
      }

      nowIndex += repeatLengthMax;
    } else {
      lengthCodeValues.push(input[nowIndex]);
      nowIndex++;
    }
  }

  return {
    repeatLengthCodeValueMax,
    repeatDistanceCodeValueMax,
    lengthCodeValues,
    distanceCodeValues,
  };
}

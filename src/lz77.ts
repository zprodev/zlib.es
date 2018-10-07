import {
  DISTANCE_EXTRA_BIT_BASE,
  LENGTH_EXTRA_BIT_BASE,
} from './const';

export function generateLZ77CodeValues(input: Uint8Array) {
  const lengthCodeValues: number[] = [256];
  const distanceCodeValues: number[] = [];
  const inputLen = input.length;
  let slideIndexBase = 0;
  let slideIndex = 0;
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
    slideIndex = 0;
    repeatLength = 0;
    repeatLengthMax = 0;
    while (slideIndexBase + slideIndex < nowIndex) {
      repeatLength = 0;
      while (input[slideIndexBase + slideIndex + repeatLength] === input[nowIndex + repeatLength]) {
        repeatLength++;
      }
      if (repeatLengthMax < repeatLength) {
        repeatLengthMax = repeatLength;
        repeatLengthMaxIndex = slideIndexBase + slideIndex;
      }
      slideIndex++;
    }
    if (repeatLengthMax >= 3) {
      distance = nowIndex - repeatLengthMaxIndex;
      for (let i = 0; LENGTH_EXTRA_BIT_BASE.length; i++) {
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

      for (let i = 0; DISTANCE_EXTRA_BIT_BASE.length; i++) {
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

export const BTYPE = Object.freeze({
  UNCOMPRESSED: 0,
  FIXED: 1,
  DYNAMIC: 2,
});

export const BLOCK_MAX_BUFFER_LEN = 131072;

export const LENGTH_EXTRA_BIT_LEN = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
  4, 4, 4, 4, 5, 5, 5, 5, 0,
];

export const LENGTH_EXTRA_BIT_BASE = [
  3,  4,  5,  6,   7,   8,   9,   10,  11,  13,
  15, 17, 19, 23,  27,  31,  35,  43,  51,  59,
  67, 83, 99, 115, 131, 163, 195, 227, 258,
];

export const DISTANCE_EXTRA_BIT_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25,
  33, 49, 65, 97, 129, 193, 257, 385, 513, 769,
  1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
];
export const DISTANCE_EXTRA_BIT_LEN = [
  0, 0, 0,  0,  1,  1,  2,  2,  3,  3,
  4, 4, 5,  5,  6,  6,  7,  7,  8,  8,
  9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];

export const CODELEN_VALUES = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

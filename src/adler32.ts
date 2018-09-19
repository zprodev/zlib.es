export function calcAdler32(input: Uint8Array) {
  let s1 = 1;
  let s2 = 0;
  const inputLen = input.length;
  for (let i = 0; i < inputLen; i++) {
    s1 = (s1 + input[i]) % 65521;
    s2 = (s1 + s2) % 65521;
  }
  return (s2 << 16) + s1;
}

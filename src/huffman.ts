export function generateHuffmanTable(codelenValues: Map<number, number[]>): Map<number, Map<number, number>> {
  const codelens = codelenValues.keys();
  let iteratorResult = codelens.next();
  let codelen = 0;
  let codelenMax = 0;
  let codelenMin = Number.MAX_SAFE_INTEGER;
  while (!iteratorResult.done) {
    codelen = iteratorResult.value;
    if (codelenMax < codelen) { codelenMax = codelen; }
    if (codelenMin > codelen) { codelenMin = codelen; }
    iteratorResult = codelens.next();
  }

  let code = 0;
  let values: number[];
  const bitlenTables = new Map();
  for (let bitlen = codelenMin; bitlen <= codelenMax; bitlen++) {
    values = codelenValues.get(bitlen) as number[];
    values.sort((a, b) => {
      if ( a < b ) { return -1; }
      if ( a > b ) { return 1; }
      return 0;
    });
    const table = new Map();
    values.forEach((value) => {
      table.set(code, value);
      code++;
    });
    bitlenTables.set(bitlen, table);
    code <<= 1;
  }
  return bitlenTables;
}

export function makeFixedHuffmanCodelenValues(): Map<number, number[]> {
  const codelenValues = new Map();
  codelenValues.set(7, new Array());
  codelenValues.set(8, new Array());
  codelenValues.set(9, new Array());
  for (let i = 0; i <= 287; i++) {
    (i <= 143) ? codelenValues.get(8).push(i) :
    (i <= 255) ? codelenValues.get(9).push(i) :
    (i <= 279) ? codelenValues.get(7).push(i) :
    codelenValues.get(8).push(i);
  }
  return codelenValues;
}

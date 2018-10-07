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
    if (values === undefined) { values = []; }
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

export function generateDeflateHuffmanTable(values: number[]): Map<number, {code: number, bitlen: number}> {
  const valuesCount: {[key: number]: number} = {};
  for (const value of values) {
    if (!valuesCount[value]) {
      valuesCount[value] = 1;
    } else {
      valuesCount[value]++;
    }
  }
  const valuesCountKeys = Object.keys(valuesCount);
  let tmpPackages: Array<{count: number, simbles: number[]}> = [];
  let tmpPackageIndex = 0;
  let packages: Array<{count: number, simbles: number[]}> = [];
  if (valuesCountKeys.length === 1) {
    packages.push({
      count: valuesCount[0],
      simbles: [Number(valuesCountKeys[0])],
    });
  } else {
    for (let i = 0; i < 15; i++) {
      packages = [];
      valuesCountKeys.forEach((value) => {
        const pack = {
          count: valuesCount[Number(value)],
          simbles: [Number(value)],
        };
        packages.push(pack);
      });
      tmpPackageIndex = 0;
      while (tmpPackageIndex + 2 <= tmpPackages.length) {
        const pack = {
          count: tmpPackages[tmpPackageIndex].count + tmpPackages[tmpPackageIndex + 1].count,
          simbles: tmpPackages[tmpPackageIndex].simbles.concat(tmpPackages[tmpPackageIndex + 1].simbles),
        };
        packages.push(pack);
        tmpPackageIndex += 2;
      }
      packages = packages.sort((a: any, b: any) => {
        if ( a.count < b.count ) { return -1; }
        if ( a.count > b.count ) { return 1; }
        return 0;
      });
      if (packages.length % 2 !== 0) {
        packages.pop();
      }
      tmpPackages = packages;
    }
  }
  const valuesCodelen: {[key: number]: number} = {};
  packages.forEach((pack) => {
    pack.simbles.forEach((symble) => {
      if (!valuesCodelen[symble]) {
        valuesCodelen[symble] = 1;
      } else {
        valuesCodelen[symble]++;
      }
    });
  });

  let group: number[];
  const valuesCodelenKeys = Object.keys(valuesCodelen);
  const codelenGroup: {[key: number]: number[]} = {};
  let code = 0;
  let codelen = 3;
  const codelenMax = codelen;
  let codelenValueMin = Number.MAX_SAFE_INTEGER;
  let codelenValueMax = 0;
  valuesCodelenKeys.forEach((valuesCodelenKey) => {
    codelen = valuesCodelen[Number(valuesCodelenKey)];
    if (!codelenGroup[codelen]) {
      codelenGroup[codelen] = [];
      if (codelenValueMin > codelen) { codelenValueMin = codelen; }
      if (codelenValueMax < codelen) { codelenValueMax = codelen; }
    }
    codelenGroup[codelen].push(Number(valuesCodelenKey));
  });

  code = 0;
  const table = new Map<number, {code: number, bitlen: number}>();
  for (let i = codelenValueMin; i <= codelenValueMax; i++) {
    group = codelenGroup[i];
    if (group) {
      group = group.sort((a, b) => {
        if ( a < b ) { return -1; }
        if ( a > b ) { return 1; }
        return 0;
      });
      group.forEach((value) => {
        table.set(value, {code, bitlen: i});
        code++;
      });
    }
    code <<= 1;
  }
  return table;
}

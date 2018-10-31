export function generateHuffmanTable(codelenValues) {
    const codelens = Object.keys(codelenValues);
    let codelen = 0;
    let codelenMax = 0;
    let codelenMin = Number.MAX_SAFE_INTEGER;
    codelens.forEach((key) => {
        codelen = Number(key);
        if (codelenMax < codelen) {
            codelenMax = codelen;
        }
        if (codelenMin > codelen) {
            codelenMin = codelen;
        }
    });
    let code = 0;
    let values;
    const bitlenTables = {};
    for (let bitlen = codelenMin; bitlen <= codelenMax; bitlen++) {
        values = codelenValues[bitlen];
        if (values === undefined) {
            values = [];
        }
        values.sort((a, b) => {
            if (a < b) {
                return -1;
            }
            if (a > b) {
                return 1;
            }
            return 0;
        });
        const table = {};
        values.forEach((value) => {
            table[code] = value;
            code++;
        });
        bitlenTables[bitlen] = table;
        code <<= 1;
    }
    return bitlenTables;
}
export function makeFixedHuffmanCodelenValues() {
    const codelenValues = {};
    codelenValues[7] = [];
    codelenValues[8] = [];
    codelenValues[9] = [];
    for (let i = 0; i <= 287; i++) {
        (i <= 143) ? codelenValues[8].push(i) :
            (i <= 255) ? codelenValues[9].push(i) :
                (i <= 279) ? codelenValues[7].push(i) :
                    codelenValues[8].push(i);
    }
    return codelenValues;
}
export function generateDeflateHuffmanTable(values, maxLength = 15) {
    const valuesCount = {};
    for (const value of values) {
        if (!valuesCount[value]) {
            valuesCount[value] = 1;
        }
        else {
            valuesCount[value]++;
        }
    }
    const valuesCountKeys = Object.keys(valuesCount);
    let tmpPackages = [];
    let tmpPackageIndex = 0;
    let packages = [];
    if (valuesCountKeys.length === 1) {
        packages.push({
            count: valuesCount[0],
            simbles: [Number(valuesCountKeys[0])],
        });
    }
    else {
        for (let i = 0; i < maxLength; i++) {
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
            packages = packages.sort((a, b) => {
                if (a.count < b.count) {
                    return -1;
                }
                if (a.count > b.count) {
                    return 1;
                }
                return 0;
            });
            if (packages.length % 2 !== 0) {
                packages.pop();
            }
            tmpPackages = packages;
        }
    }
    const valuesCodelen = {};
    packages.forEach((pack) => {
        pack.simbles.forEach((symble) => {
            if (!valuesCodelen[symble]) {
                valuesCodelen[symble] = 1;
            }
            else {
                valuesCodelen[symble]++;
            }
        });
    });
    let group;
    const valuesCodelenKeys = Object.keys(valuesCodelen);
    const codelenGroup = {};
    let code = 0;
    let codelen = 3;
    const codelenMax = codelen;
    let codelenValueMin = Number.MAX_SAFE_INTEGER;
    let codelenValueMax = 0;
    valuesCodelenKeys.forEach((valuesCodelenKey) => {
        codelen = valuesCodelen[Number(valuesCodelenKey)];
        if (!codelenGroup[codelen]) {
            codelenGroup[codelen] = [];
            if (codelenValueMin > codelen) {
                codelenValueMin = codelen;
            }
            if (codelenValueMax < codelen) {
                codelenValueMax = codelen;
            }
        }
        codelenGroup[codelen].push(Number(valuesCodelenKey));
    });
    code = 0;
    const table = new Map();
    for (let i = codelenValueMin; i <= codelenValueMax; i++) {
        group = codelenGroup[i];
        if (group) {
            group = group.sort((a, b) => {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            });
            group.forEach((value) => {
                table.set(value, { code, bitlen: i });
                code++;
            });
        }
        code <<= 1;
    }
    return table;
}

// Loads the game's browser scripts into one Node context so tools share the exact game data.
const fs = require('fs'), path = require('path'), vm = require('vm');
const JS = path.join(__dirname, '..', 'js');

module.exports = function load(files) {
  const ctx = { Math, JSON, console, structuredClone };
  vm.createContext(ctx);
  const names = [];
  for (const f of files) {
    const p = path.join(JS, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)) names.push(m[1]);
    vm.runInContext(src, ctx, { filename: f });
  }
  return vm.runInContext(`({${names.join(',')}})`, ctx);
};

/* 2x2 native runtime: install bundled classic tool meshes, textures and sounds.
 * Missing optional files must not make an otherwise playable map unlaunchable.
 */
(function (root) {
  'use strict';
  const prefix = '/native-legacy-assets/';
  const isSafe = rel => typeof rel === 'string' &&
    /^(fonts|textures|sounds)\/[A-Za-z0-9_.\-/]+$/.test(rel) &&
    !rel.split('/').some(x => !x || x === '..' || x === '.');

  async function download(fetcher, notify) {
    const response = await fetcher(prefix + 'manifest.json', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('Legacy asset index: HTTP ' + response.status);
    // Different releases may expose either an array or {files: [...]}.
    // A response with the wrong shape is not grounds to abort the game.
    let payload;
    try { payload = await response.json(); }
    catch { throw Error('Legacy asset manifest is not JSON (check static site routing)'); }
    const paths = Array.isArray(payload) ? payload : payload?.files;
    if (!Array.isArray(paths)) {
      const shape = Array.isArray(payload) ? 'array' : payload === null ? 'null' : typeof payload;
      throw Error('Malformed legacy asset manifest (expected paths array or {files: paths}; got ' + shape + ')');
    }
    if (!paths.every(isSafe) || new Set(paths).size !== paths.length)
      throw Error('Malformed legacy asset manifest (unsafe/duplicate paths)');
    const files = [], missing = [];
    let next = 0, complete = 0;
    await Promise.all(Array.from({ length: Math.min(6, paths.length) }, async () => {
      while (next < paths.length) {
        const rel = paths[next++];
        const url = prefix + rel.split('/').map(encodeURIComponent).join('/');
        const item = await fetcher(url, { credentials: 'same-origin' });
        if (item.status === 404) missing.push(rel);
        else if (!item.ok) throw Error('Legacy asset ' + rel + ': HTTP ' + item.status);
        else files.push([rel, new Uint8Array(await item.arrayBuffer())]);
        complete++;
        if (notify && (complete === paths.length || complete % 25 === 0)) notify(complete, paths.length);
      }
    }));
    return { files, missing, expected: paths.length };
  }

  function install(fs, result) {
    if (!fs || typeof fs.analyzePath !== 'function' || typeof fs.mkdirTree !== 'function' || typeof fs.writeFile !== 'function')
      throw Error('Native filesystem unavailable for legacy assets');
    let installed = 0;
    function put(file, contents) {
      if (fs.analyzePath(file).exists) return;
      fs.mkdirTree(file.slice(0, file.lastIndexOf('/')));
      fs.writeFile(file, contents);
      installed++;
    }
    for (const [rel, bytes] of result.files) put('/content/' + rel, bytes);
    function alias(source, target) {
      if (!fs.analyzePath(source).exists) return;
      fs.mkdirTree(target);
      for (const name of fs.readdir(source)) {
        if (name === '.' || name === '..') continue;
        const from = source + '/' + name;
        const to = target + '/' + name;
        if (fs.isDir(fs.stat(from).mode)) alias(from, to);
        else put(to, fs.readFile(from));
      }
    }
    alias('/content/textures', '/content/Textures');
    alias('/content/fonts', '/content/Fonts');
    alias('/content/sounds', '/content/Sounds');
    return installed;
  }
  root.NativeLegacyAssets = { download, install, isSafe };
})(typeof window !== 'undefined' ? window : globalThis);

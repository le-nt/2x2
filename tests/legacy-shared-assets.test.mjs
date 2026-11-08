import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {archiveRoots,findLegacyArchiveFile,validLegacyPath} from '../server/lib/legacy-shared-assets.mjs';

test('historical shareddata paths resolve from other folders case insensitively',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'2x2-shared-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'my-archive');
 const f=path.join(root,'RiseOfTheKillbots','fonts','Shotgun.mesh');
 fs.mkdirSync(path.dirname(f),{recursive:true});
 fs.writeFileSync(f,'version 1.00');
 const roots=archiveRoots(dir,root);
 assert.equal(findLegacyArchiveFile(roots,'riseofthekillbots/fonts/shotgun.mesh'),fs.realpathSync(f));
 assert.equal(findLegacyArchiveFile(roots,'Sky/missing.png'),null);
 for(const s of ['../hidden.png','foo/../../secret.wav','/etc/passwd','foo\\bar.png','foo/bar.exe'])
  assert.equal(validLegacyPath(s),false);
 assert.equal(validLegacyPath('Sky/redsky512_rt.png'),true);
});

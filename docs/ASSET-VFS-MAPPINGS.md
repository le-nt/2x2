# Verified archive relocations

`asset-vfs-config.json` can contain a `mappings` array for resources whose
historical archive layout differs from the runtime's expected relative path:

```json
{
  "manifest": "asset-vfs-manifest.json",
  "roots": [],
  "mappings": [
    {
      "from": "fonts/humanoidHealthRegenScript.rbxm",
      "to": "avatar/scripts/humanoidHealthRegenScript.rbxmx",
      "sha256": "1ae85f5d8235a88a1f30ced4d56ad2a7b71f326df204cb51f9a3dfe6ca000fe1",
      "reason": "Native Player.cpp expects the character Health script under fonts; the inspected 2017L-Studio archive stores the original regeneration Script under avatar/scripts."
    }
  ]
}
```

Keep existing roots when editing configuration. The example hash identifies the
inspected local archive file, not every historical revision of that resource.
The file is XML containing one enabled Script named `Health`. It regenerates
Humanoid health and waits on `HealthChanged:Wait()`. Its original bytes remain
in the archive. The engine now accepts the capitalized signal alias; native
yield/resume behavior is covered by the RCC probe. This is an explicit
compatibility mapping, not a claim that 2016 shipped identical bytes.

Mappings are administrator configuration, never client input. Both paths must
pass normal VFS validation; target bytes must exist in an inventoried trusted
root and match the pinned SHA-256. No recursive mappings, basename searches,
physical relocation or fabricated numeric IDs are involved. An existing exact
path always wins. Conflicts, integrity failures and version mismatches cannot
be hidden by a mapping. At most 4,096 mappings are accepted, with unique source
paths and a bounded required explanation. Import resource reports preserve the
selected mapping and target provenance.

This mapping is currently used in the isolated validation configuration. It is
not automatically added to production or newly generated configurations. Native
player entry, respawn ordering and health regeneration still need broader
gameplay validation before a default mapping is selected.

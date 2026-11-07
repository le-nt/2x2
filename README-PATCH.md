# 2x2 source audit patch

This patch can be copied into the **existing** `C:\RBXBanland` project, retaining folder paths. It contains no client binaries, maps, credentials, or account databases.

## Fix

`tools/import-novetus.py`: corrects detection of single-folder `maps/` and `legacy/` ZIPs and hardens map-catalog collision handling so two different source map paths cannot accidentally share one existing untagged catalog row. Also checks registry filenames as safe basenames when reporting missing native maps.

`tests/test_novetus_import.py`: includes a repeat-import regression test for same-name modern maps from different source folders.

`tools/export-source.ps1`: creates a properly structured lightweight source ZIP for future inspection. Unlike the original `Compress-Archive -LiteralPath $files.FullName` command, it preserves each file's relative path. It deliberately excludes the entrance-key config and database paths.

## Test

From project root:

```powershell
py -m unittest discover -s tests -p 'test_novetus_import.py' -v
```

## Structured source export

```powershell
powershell -ExecutionPolicy Bypass -File tools\export-source.ps1 -Root 'C:\RBXBanland'
```

## Important limits

This source-only audit does not prove native Roblox execution, does not restore live Lua functionality, and cannot verify binary map contents without the separate local map pack. Preserve the original project before replacing any files.

#include "stdafx.h"
#include "script/LuaVM.h"
#include "v8datamodel/HackDefines.h"
#include "v8datamodel/DataModel.h"
#include "security/FuzzyTokens.h"
#include "security/ApiSecurity.h"

#include "script/ScriptContext.h"
#include "network/api.h"

#include "luaconf.h"

#include "VirtualizerSDK.h"

struct lua_State;

// If you are getting to this point in a debugger, you probably added a lua_*
// call to one of the VM protected sections.
void lua_vmhooked_handler(lua_State* L) {
    VIRTUALIZER_START
    RBX::Tokens::apiToken.addFlagFast(RBX::kLuaHooked);
    RBX::pmcHash.nonce = 0;
    RBX::Tokens::sendStatsToken.addFlagFast(HATE_LUA_VM_HOOKED);
    RBX::DataModel* dm = RBX::DataModel::get(RobloxExtraSpace::get(L)->context());
    if (dm)
    {
        dm->addHackFlag(HATE_LUA_VM_HOOKED);
    }
    VIRTUALIZER_END
};

#ifdef RBX_SECURE_DOUBLE
RBX_ALIGN(16) int LuaSecureDouble::luaXorMask[4];

// For lua, create a random bitstring to use for doubles.
// Mainly care about the exponent bits.  This ensures at least one of the top 7 exp
// bits gets changed.
void LuaSecureDouble::initDouble()
{
    uint32_t luaRandMask;
    do
    {
        luaRandMask = (rand() << 16) | rand();
    } while ((luaRandMask & 0x7F000000) == 0);

    for (int i = 0; i < sizeof(LuaSecureDouble::luaXorMask)/sizeof(int); ++i)
    {
        LuaSecureDouble::luaXorMask[i] = luaRandMask;
    }
}
#endif

#ifdef _WIN32
#include <windows.h>
#include <cstdint>
#include <cstring>

namespace RBX { namespace Security {
    static uintptr_t getTextBase() {
        HMODULE hModule = GetModuleHandle(nullptr);
        if (!hModule) return 0x00400000;

        auto base = reinterpret_cast<uint8_t*>(hModule);
        auto dos = reinterpret_cast<PIMAGE_DOS_HEADER>(base);
        if (dos->e_magic != IMAGE_DOS_SIGNATURE) return 0x00400000;
        auto nt = reinterpret_cast<PIMAGE_NT_HEADERS>(base + dos->e_lfanew);
        if (nt->Signature != IMAGE_NT_SIGNATURE) return 0x00400000;

        auto sect = IMAGE_FIRST_SECTION(nt);
        WORD nsec = nt->FileHeader.NumberOfSections;
        for (WORD i = 0; i < nsec; ++i, ++sect) {
            if (std::strncmp(reinterpret_cast<const char*>(sect->Name), ".text", 5) == 0)
                return reinterpret_cast<uintptr_t>(base + sect->VirtualAddress);
        }
        return reinterpret_cast<uintptr_t>(base);
    }

    static size_t getTextSize() {
        HMODULE hModule = GetModuleHandle(nullptr);
        if (!hModule) return 0xFFFFFFFF;

        auto base = reinterpret_cast<uint8_t*>(hModule);
        auto dos = reinterpret_cast<PIMAGE_DOS_HEADER>(base);
        if (dos->e_magic != IMAGE_DOS_SIGNATURE) return 0xFFFFFFFF;
        auto nt = reinterpret_cast<PIMAGE_NT_HEADERS>(base + dos->e_lfanew);
        if (nt->Signature != IMAGE_NT_SIGNATURE) return 0xFFFFFFFF;

        auto sect = IMAGE_FIRST_SECTION(nt);
        WORD nsec = nt->FileHeader.NumberOfSections;
        for (WORD i = 0; i < nsec; ++i, ++sect) {
            if (std::strncmp(reinterpret_cast<const char*>(sect->Name), ".text", 5) == 0)
                return sect->Misc.VirtualSize ? sect->Misc.VirtualSize : sect->SizeOfRawData;
        }
        return nt->OptionalHeader.SizeOfImage;
    }

    volatile uintptr_t rbxTextBase = getTextBase();
    volatile size_t    rbxTextSize = getTextSize();
} }
#else
#include "util/ELFBaseAddr.h"
namespace RBX { namespace Security {
    volatile uintptr_t rbxTextBase = elfDynamicBaseAddress();
    volatile size_t    rbxTextSize = elfTextSize();
} } // namespace RBX::Security

#endif // _WIN32
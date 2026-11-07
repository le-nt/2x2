#pragma once

#include <stdint.h>
#include <vector>
#include <cstring>
#include <cstdio>

#include "security/FuzzyTokens.h"
#include "security/RandomConstant.h"

#if defined(RBX_PLATFORM_DURANGO)

    #define NOINLINE __declspec(noinline)

#elif defined(_WIN32)

    #include <windows.h>
    #include <winternl.h>
    #undef min

    #define FORCEINLINE __forceinline
    #define NOINLINE __declspec(noinline)

#elif defined(EMSCRIPTEN)
    #define FORCEINLINE inline __attribute__((always_inline))
    #define NOINLINE __attribute__((noinline))
#else

    #include <unistd.h>
    #include <elf.h>
    #include <link.h>
    #include <dlfcn.h>

    #define FORCEINLINE inline __attribute__((always_inline))
    #define NOINLINE __attribute__((noinline))

    extern "C" {
        extern char __executable_start;
        extern char etext;
    }

#endif

namespace RBX { namespace Security {

    extern volatile uintptr_t rbxTextBase;
    extern volatile size_t    rbxTextSize;
    extern volatile const uintptr_t rbxTextEndNeg;
    extern volatile const size_t    rbxTextSizeNeg;
    extern volatile const uintptr_t rbxVmpBase;
    extern volatile const size_t    rbxVmpSize;

}}

namespace RBX {


static const unsigned int kNameApiOffset        = 0;
static const unsigned int kRbxLockedApiOffset   = 3;
static const unsigned int kChangeStateApiOffset = 4;
static const unsigned int kNtApiNoNtdll         = (1<<8);
static const unsigned int kNtApiNoText          = (1<<9);
static const unsigned int kNtApiNoApi           = (1<<10);
static const unsigned int kNtApiNoSyscall       = (1<<11);
static const unsigned int kNtApiNoTemplate      = (1<<12);
static const unsigned int kNtApiEarly           = (1<<13);
static const unsigned int kNtApiHash            = (1<<14);
static const unsigned int kNtApiNoCall          = (1<<15);
static const unsigned int kVehWpmFail           = (1<<16);
static const unsigned int kVehPrologFail        = (1<<17);
static const unsigned int kVehNoNtdll           = (1<<18);
static const unsigned int kPingItem             = (1<<19);
static const unsigned int kScriptContextCopy    = (1<<20);
static const unsigned int kLuaHooked            = (1<<21);

FORCEINLINE static bool isRbxTextAddr(const void* const ptr)
{
#if defined(RBX_STUDIO_BUILD) || defined(RBX_RCC_SECURITY)
    return true;
#elif defined(EMSCRIPTEN)
    return true;
#else
    return (reinterpret_cast<uintptr_t>(ptr) - RBX::Security::rbxTextBase
            < RBX::Security::rbxTextSize);
#endif
}

template<unsigned int value>
FORCEINLINE void callCheckSetBasicFlag(unsigned int flags)
{
    Tokens::sendStatsToken.addFlagFast(value);
    Tokens::simpleToken |= value;
}

template<unsigned int offset>
FORCEINLINE void callCheckSetApiFlag(unsigned int flags)
{
    Tokens::apiToken.addFlagSafe(flags << offset);
}

FORCEINLINE void callCheckNop(unsigned int flags)
{
}

static const int kCallCheckCodeOnly      = 1;
static const int kCallCheckCallArg       = 2;
static const int kCallCheckCallersCode   = 3;
static const int kCallCheckRegCall       = 4;

template<int level, void(*action)(unsigned int)>
FORCEINLINE static unsigned int checkRbxCaller(const void* const funcAddress)
{
#if defined(_WIN32) && !defined(_NOOPT) && !defined(LOVE_ALL_ACCESS) \
    && !defined(RBX_STUDIO_BUILD) && !defined(RBX_PLATFORM_DURANGO)

    unsigned int flags = 0;

    void* returnAddress = _ReturnAddress();
    flags |= isRbxTextAddr(returnAddress) ? 0 : (1<<0);

    if (!flags)
    {
        switch (level)
        {
            case kCallCheckCallersCode:
            {
#ifdef _WIN64
                void* backtrace[2] = { nullptr, nullptr };
                USHORT captured = RtlCaptureStackBackTrace(1, 2, backtrace, nullptr);
                void* secondReturnAddress = (captured >= 2) ? backtrace[1] : nullptr;
                flags |= isRbxTextAddr(secondReturnAddress) ? 0 : (1 << 2);
#else
                void* aora = _AddressOfReturnAddress();
                void* secondReturnAddress = (*((void***)(aora)-1))[1];
                flags |= isRbxTextAddr(secondReturnAddress) ? 0 : (1 << 2);
#endif
            }
            [[fallthrough]];
            case kCallCheckCallArg:
            {
                unsigned int offset = *((unsigned int*)(returnAddress) - 1);
                flags |= (offset == ((unsigned int)(funcAddress)
                        - (unsigned int)(returnAddress))) ? 0 : (1<<1);
            }
            break;

            case kCallCheckRegCall:
            {
                static const unsigned short kX86RegCall = 0xD7FF;
                unsigned short opcode = *((unsigned short*)(returnAddress) - 1);
                flags |= ((opcode|0x0700) == kX86RegCall) ? 0 : (1<<3);
            }
            break;

            default:
                break;
        }
    }

    if (flags)
        action(flags);

    return flags;

#elif defined(EMSCRIPTEN)
    return 0;

#else

    unsigned int flags = 0;

    void* returnAddress = __builtin_return_address(0);
    if (!isRbxTextAddr(returnAddress))
        flags |= 1<<0;

    if (level >= kCallCheckCallArg)
    {
        void* callerFrame = __builtin_frame_address(1);
        void* callerAddr = *(void**)(reinterpret_cast<uintptr_t>(callerFrame) + sizeof(void*));
        if (!isRbxTextAddr(callerAddr))
            flags |= 1<<1;
    }

    if (level >= kCallCheckCallersCode)
    {
        void* secondFrame = __builtin_frame_address(2);
        void* secondAddr = *(void**)(reinterpret_cast<uintptr_t>(secondFrame) + sizeof(void*));
        if (!isRbxTextAddr(secondAddr))
            flags |= 1<<2;
    }

    if (flags)
        action(flags);

    return flags;

#endif
}

namespace Security {
    static const unsigned int kCheckDefault      = 0;
    static const unsigned int kCheckReturnAddr   = 1;
    static const unsigned int kCheckNoThreadInit = 2;
    static const unsigned int kAllowVmpAll       = 4;
}

struct CallChainInfo
{
    uint32_t handler;
    uint32_t ret;

    CallChainInfo() : handler(0), ret(0) {}
    CallChainInfo(uint32_t h, uint32_t r) : handler(h), ret(r) {}
};

template<size_t kMaxDepth>
FORCEINLINE uint32_t detectDllByExceptionChain(void* addrOfChain, unsigned int kFlags)
{
#if defined(EMSCRIPTEN)
    return 0;
#else
    return 0;
#endif
}

template<size_t kMaxDepth>
FORCEINLINE void generateCallInfo(void* addrOfFirstArg, std::vector<CallChainInfo>& info)
{
#if defined(EMSCRIPTEN)
    return;
#else
    return;
#endif
}

template<size_t kMaxDepth>
FORCEINLINE uint32_t detectDllByExceptionChainStack(void* addrOfFirstArg, unsigned int kFlags)
{
#if defined(EMSCRIPTEN)
    return 0;
#else
    return 0;
#endif
}

template<size_t kMaxDepth>
FORCEINLINE uint32_t detectDllByExceptionChainTeb(unsigned int kFlags)
{
#if defined(EMSCRIPTEN)
    return 0;
#else
    return 0;
#endif
}

} // namespace RBX

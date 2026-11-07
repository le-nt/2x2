#pragma once
#include "boost/thread/mutex.hpp"

namespace RBX
{
    // This is designed to be an anti-tamper security reporting mechanism.
    // Add flag is based on the number of bits in the flag, and succeeds
    // with probability 1 - 0.5**N per transmitted packet.  This might
    // seem like an issue, but most of the checks will re-trigger an addition
    // meaning an exploiter is unlikely to be in the game for more than 30
    // seconds.  Attempts to modify the packet are very likely to fail.

    namespace Security
    {
        uint64_t teaDecrypt(uint64_t inTag);
        uint64_t teaEncrypt(uint64_t inTag);
    }

    namespace Tokens
    {
        union binaryTag
        {
            unsigned int asHalf[2];
            uint64_t asFull;
        };
    }

    class ClientFuzzySecurityToken 
    {
        Tokens::binaryTag tag;
        Tokens::binaryTag prevTag;
        Tokens::binaryTag savedTag;
        boost::mutex tokenMutex;
    public:
        ClientFuzzySecurityToken(uint64_t inTag);
        void set(uint64_t inTag);

#ifdef WIN32
        __forceinline
#else
        inline
#endif
        void addFlagFast(uint64_t flags)
        {
            tag.asFull |= flags;
        }

#ifdef WIN32
        __forceinline
#else
        inline
#endif
        void addFlagSafe(uint64_t flags)
        {
            boost::mutex::scoped_lock lock(tokenMutex);
            tag.asFull |= flags;
        }
        uint64_t crypt();
        uint64_t getPrev()
        {
            return prevTag.asFull;
        }
    };

    // The server can check this.  Each '1' transmitted from the client has
    // a 50% chance of being a '0' here, thus it it fuzzy.
    class ServerFuzzySecurityToken
    {
        Tokens::binaryTag lastTag;
        Tokens::binaryTag tag;
        unsigned int ignoreFlags;
    public:
        ServerFuzzySecurityToken(uint64_t inTag, unsigned int ignoreFlags = 0);
        void setLastTag(uint64_t tag) { lastTag.asFull = tag;}
        uint64_t decrypt(uint64_t inTag);
    };

    namespace Tokens
    {
        extern ClientFuzzySecurityToken sendStatsToken;
        extern unsigned int simpleToken;
        extern ClientFuzzySecurityToken apiToken;
    }

}


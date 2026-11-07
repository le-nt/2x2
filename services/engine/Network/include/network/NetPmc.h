#pragma once
#include <stdint.h>
#include <vector>
#include "boost/thread/mutex.hpp"

namespace RBX { namespace Network {
class Replicator;
}
}

namespace RBX {
namespace Security{

struct NetPmcChallenge
{
    // these will be encrypted on the game client
    uint32_t base;
    uint32_t size;
    uint32_t seed; 
    // This will be encrypted in a different way.
    uint32_t result;

    NetPmcChallenge& operator^=(const NetPmcChallenge& rhs)
    {
        this->base   ^= rhs.base;
        this->size   ^= rhs.size;
        this->seed   ^= rhs.seed;
        this->result ^= rhs.result;
        return *this;
    }
};

const size_t kNumChallenges = 128;
extern const volatile NetPmcChallenge kChallenges[kNumChallenges];

#ifndef RBX_STUDIO_BUILD

uint32_t netPmcHashCheck(const NetPmcChallenge& challenge);

#endif

void salsa20(uint8_t *message, uint64_t mlen, uint8_t key[32], uint64_t nonce);

#ifdef RBX_RCC_SECURITY
extern std::vector<NetPmcChallenge> netPmcKeys;

class NetPmcServer
{
    std::vector<uint8_t> challenges;
    uint8_t challengeIdx;

    std::vector<uint8_t> challengesInFlight;
    boost::mutex flightMutex;

    bool isGameCreator;
    bool gameHasManyPlayers;
    bool gameHasManyParts;
    bool userHasActivity;

    size_t challengesSent;
    size_t challengesRecv;

public:
    NetPmcServer();

    // the intent it to make it much harder to detect this mechanism by making it
    // only work in places that are actually games.
    bool canSendChallenge(const RBX::Network::Replicator* rep); /*non-const*/

    bool tooManyPending() const;

    uint8_t getRandomChallenge();

    bool sendChallenge(uint8_t idx);

    bool removeFromList(uint8_t idx);

    bool checkResult(uint8_t idx, uint32_t response, uint64_t correct) const;

    unsigned int generateDebugInfo(const RBX::Network::Replicator* rep, uint32_t& sent, uint32_t& recv, uint32_t& pending) const;

};
#endif

}
}


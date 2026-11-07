#pragma once

#include "Item.h"
#include "Replicator.h"
#include "util/ProgramMemoryChecker.h"

namespace RBX {
    namespace Network {

        class Replicator::HashItem : public Item
        {
            PmcHashContainer hashes;
            uint64_t fuzzyToken;
            uint64_t apiToken;
            uint64_t prevApiToken;
        public:
            HashItem(Replicator* replicator, const PmcHashContainer* const hashes, uint64_t fuzzyToken,
                uint64_t apiToken, uint64_t prevApiToken);

            /*implement*/ virtual bool write(RakNet::BitStream& bitStream);
        };

    }
}

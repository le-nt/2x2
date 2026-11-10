#include "GetTime.h"
#include <atomic>
#include <cassert>
#include <chrono>
#include <sys/time.h>
#include <thread>
#include <vector>

static std::atomic<long long> wallUs{100000000};
extern "C" int gettimeofday(timeval* value, void*)
#ifndef __EMSCRIPTEN__
    noexcept
#endif
{
    const auto now = wallUs.load();
    value->tv_sec = now / 1000000;
    value->tv_usec = now % 1000000;
    return 0;
}

int main()
{
    const auto before = RakNet::GetTimeUS();
    wallUs -= 10000000;
    const auto backward = RakNet::GetTimeUS();
    assert(backward >= before && backward - before < 1000000);
    wallUs += 3600000000LL;
    const auto forward = RakNet::GetTimeUS();
    assert(forward >= backward && forward - backward < 1000000);
    std::vector<std::thread> workers;
    for (int n = 0; n < 8; ++n)
        workers.emplace_back([] {
            auto previous = RakNet::GetTimeUS();
            for (int i = 0; i < 10000; ++i) {
                const auto current = RakNet::GetTimeUS();
                assert(current >= previous && current - previous < 1000000);
                previous = current;
            }
        });
    for (auto& thread : workers) thread.join();
    const auto start = RakNet::GetTimeUS();
    std::this_thread::sleep_for(std::chrono::milliseconds(15));
    const auto elapsed = RakNet::GetTimeUS() - start;
    assert(elapsed >= 10000 && elapsed < 1000000);
}

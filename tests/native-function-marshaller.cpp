#include "FunctionMarshaller.h"
#include <array>
#include <atomic>
#include <cassert>
#include <chrono>
#include <thread>
#include <vector>

int main()
{
    RBX::FunctionMarshaller marshaller;
    const auto owner = std::this_thread::get_id();
    bool executed = false;
    marshaller.Execute([&] { executed = true; });
    assert(executed);
    executed = false;
    std::thread submitter([&] {
        marshaller.Execute([&] {
            assert(std::this_thread::get_id() == owner);
            executed = true;
        });
    });
    submitter.join();
    assert(!executed);
    marshaller.ProcessJobs();
    assert(executed);
    constexpr int producers = 4, perProducer = 20000;
    std::array<std::atomic<int>, producers> completed{};
    for (auto& count : completed) count = 0;
    std::atomic<bool> start{false};
    std::atomic<int> finished{0};
    std::vector<std::thread> workers;
    for (int producer = 0; producer < producers; ++producer)
        workers.emplace_back([&, producer] {
            while (!start.load()) std::this_thread::yield();
            for (int i = 0; i < perProducer; ++i)
                marshaller.Submit([&, producer] { ++completed[producer]; });
            ++finished;
        });
    start = true;
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
    while (finished != producers) {
        assert(std::chrono::steady_clock::now() < deadline);
        marshaller.ProcessJobs();
        std::this_thread::yield();
    }
    for (auto& worker : workers) worker.join();
    marshaller.ProcessJobs();
    for (auto& count : completed) assert(count == perProducer);
    // Jobs may enqueue further jobs; callbacks must run outside the queue lock.
    bool nested = false;
    marshaller.Submit([&] { marshaller.Submit([&] { nested = true; }); });
    marshaller.ProcessJobs();
    assert(!nested);
    marshaller.ProcessJobs();
    assert(nested);
}

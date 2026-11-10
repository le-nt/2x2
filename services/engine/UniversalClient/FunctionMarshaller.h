#pragma once

#include <functional>
#include <queue>
#include <atomic>

#include <mutex>
#include <condition_variable>
#include <thread>


namespace RBX
{
    class FunctionMarshaller
    {
    public:
        FunctionMarshaller();
        ~FunctionMarshaller();

        void Execute(std::function<void()> job);

        void Submit(std::function<void()> job);

        void ProcessJobs();
    private:
        std::queue<std::function<void()>> jobQueue;
        std::mutex queueMutex;
        std::condition_variable cv;
        std::atomic<bool> stopFlag;
        std::thread::id marshallerThreadId;

    };
}
#pragma once

#include <functional>
#include <queue>
#include <atomic>

#ifndef EMSCRIPTEN
#include <mutex>
#include <condition_variable>
#include <thread>
#endif

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
#ifdef EMSCRIPTEN
        std::queue<std::function<void()>> jobQueue;
#else
        std::queue<std::function<void()>> jobQueue;
        std::mutex queueMutex;
        std::condition_variable cv;
        std::atomic<bool> stopFlag;
        std::thread::id marshallerThreadId;
#endif
    };
}
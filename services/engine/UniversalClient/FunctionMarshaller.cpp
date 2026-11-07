#include "FunctionMarshaller.h"

namespace RBX
{
#ifdef EMSCRIPTEN
    FunctionMarshaller::FunctionMarshaller()
    {
    }

    FunctionMarshaller::~FunctionMarshaller()
    {
    }

    void FunctionMarshaller::Execute(std::function<void()> job)
    {
        job();
    }

    void FunctionMarshaller::Submit(std::function<void()> job)
    {
        jobQueue.push(std::move(job));
    }

    void FunctionMarshaller::ProcessJobs()
    {
        if (jobQueue.empty())
        {
            return;
        }
        
        std::queue<std::function<void()>> localQueue;
        std::swap(localQueue, jobQueue);

        while (!localQueue.empty())
        {
            localQueue.front()();
            localQueue.pop();
        }
    }

#else


    FunctionMarshaller::FunctionMarshaller()
        : stopFlag(false)
        , marshallerThreadId(std::this_thread::get_id())
    {
    }

    FunctionMarshaller::~FunctionMarshaller()
    {
        stopFlag = true;
        cv.notify_all();
    }

    void FunctionMarshaller::Execute(std::function<void()> job)
    {
        if (std::this_thread::get_id() == marshallerThreadId)
        {
            job();
        }
        else
        {
            Submit(std::move(job));
        }
    }

    void FunctionMarshaller::Submit(std::function<void()> job)
    {
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            jobQueue.push(std::move(job));
        }
        cv.notify_one();
    }

    void FunctionMarshaller::ProcessJobs()
    {
        std::queue<std::function<void()>> localQueue;

        {
            std::unique_lock<std::mutex> lock(queueMutex);
            if (jobQueue.empty() || stopFlag.load())
                return;

            std::swap(localQueue, jobQueue);
        }

        while (!localQueue.empty())
        {
            localQueue.front()();
            localQueue.pop();
        }
    }

#endif
};
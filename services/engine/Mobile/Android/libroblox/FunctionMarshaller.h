#pragma once

#include <map>
#include <string>
#include <boost/function.hpp>
#include <boost/thread/recursive_mutex.hpp>
#include "rbx/threadsafe.h"
#include "rbx/CEvent.h"

namespace RBX {

class FunctionMarshaller
{
public:
    struct Closure
    {
        boost::function<void()>* f;
        std::string errorMessage;
        RBX::CEvent* waitEvent;
    };

private:
    struct StaticData
    {
#ifdef _WIN32
        using ThreadIDType = DWORD;
#else
        using ThreadIDType = pthread_t;
#endif

        std::map<ThreadIDType, FunctionMarshaller*> windows;
        boost::recursive_mutex windowsCriticalSection;

        ~StaticData();
    };

    SAFE_STATIC(StaticData, staticData)

    rbx::safe_queue<boost::function<void()>*> asyncCalls;
    int refCount;

#ifdef _WIN32
    using ThreadIDType = DWORD;
#else
    using ThreadIDType = pthread_t;
#endif
    ThreadIDType threadID;

    FunctionMarshaller(ThreadIDType threadID);
    ~FunctionMarshaller();

public:
    static FunctionMarshaller* GetWindow();
    static void ReleaseWindow(FunctionMarshaller* window);

    static void handleAppEvent(void* pClosure);
    static void freeAppEvent(void* pClosure);

    void Execute(boost::function<void()> job, CEvent* waitEvent);
    void Submit(boost::function<void()> job);

    // Only call from the Window's thread
    void ProcessMessages();

private:
    // Disable copying
    FunctionMarshaller(const FunctionMarshaller&) = delete;
    FunctionMarshaller& operator=(const FunctionMarshaller&) = delete;
};

} // namespace RBX
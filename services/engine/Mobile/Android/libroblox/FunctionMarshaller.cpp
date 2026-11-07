#include "FunctionMarshaller.h"
#include "JNIMain.h"
#include "util/standardout.h"

using namespace RBX;

FunctionMarshaller::FunctionMarshaller(
#ifdef _WIN32
    DWORD threadID
#else
    pthread_t threadID
#endif
) : refCount(0)
{
    this->threadID = threadID;
}

FunctionMarshaller::~FunctionMarshaller()
{
    boost::function<void()>* f;
    while (asyncCalls.pop_if_present(f))
        delete f;

#ifdef _WIN32
    RBXASSERT(threadID == GetCurrentThreadId());
#else
    RBXASSERT(pthread_equal(threadID, pthread_self()));
#endif

#ifdef _DEBUG
    {
        boost::recursive_mutex::scoped_lock lock(staticData().windowsCriticalSection);
        RBXASSERT(refCount == 0);
        RBXASSERT(staticData().windows.find(threadID) == staticData().windows.end());
    }
#endif
}

FunctionMarshaller* FunctionMarshaller::GetWindow()
{
    boost::recursive_mutex::scoped_lock lock(staticData().windowsCriticalSection);

#ifdef _WIN32
    DWORD tid = GetCurrentThreadId();
#else
    pthread_t tid = pthread_self();
#endif

    auto find = staticData().windows.find(tid);
    if (find != staticData().windows.end()) {
        find->second->refCount++;
        return find->second;
    }

    FunctionMarshaller* window = new FunctionMarshaller(tid);
    staticData().windows[tid] = window;
    window->refCount++;
    return window;
}

void FunctionMarshaller::ReleaseWindow(FunctionMarshaller* window)
{
    boost::recursive_mutex::scoped_lock lock(staticData().windowsCriticalSection);
    window->refCount--;
    if (window->refCount == 0) {
        staticData().windows.erase(window->threadID);
    }
}

void FunctionMarshaller::Execute(boost::function<void()> job, CEvent* waitEvent)
{
#ifdef _WIN32
    if (threadID == GetCurrentThreadId())
#else
    if (pthread_equal(threadID, pthread_self()))
#endif
    {
        job();
    }
    else {
        Closure* pClosure = new Closure;
        pClosure->f = new boost::function<void()>(job);
        pClosure->waitEvent = waitEvent;
        RBX::JNI::sendAppEvent(pClosure);
    }
}

void FunctionMarshaller::Submit(boost::function<void()> job)
{
    Closure* pClosure = new Closure;
    pClosure->f = new boost::function<void()>(job);
    pClosure->waitEvent = nullptr;
    RBX::JNI::postAppEvent(pClosure);
}

void FunctionMarshaller::ProcessMessages()
{
    RBX::JNI::processAppEvents();
}

void FunctionMarshaller::handleAppEvent(void* pClosure)
{
    Closure* closure = (Closure*)pClosure;
    CEvent* pWaitEvent = closure->waitEvent;
    try {
        (*closure->f)();
        delete closure->f;
        delete closure;
    } catch (RBX::base_exception& e) {
        StandardOut::singleton()->print(RBX::MESSAGE_ERROR, e);
        closure->errorMessage = e.what();
    }

    if (pWaitEvent)
        pWaitEvent->Set();
}

void FunctionMarshaller::freeAppEvent(void* pClosure)
{
    Closure* closure = (Closure*)pClosure;
    delete closure->f;
    delete closure;
}

FunctionMarshaller::StaticData::~StaticData()
{
    // cleanup windows if needed
}
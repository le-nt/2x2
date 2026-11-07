#pragma once
#include <windows.h>

typedef DWORD pthread_t;

inline pthread_t pthread_self() {
    return GetCurrentThreadId();
}

inline int pthread_equal(pthread_t t1, pthread_t t2) {
    return t1 == t2;
}
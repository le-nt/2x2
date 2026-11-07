#include "LogManager.h"
#include "RobloxUtilities.h"
#include "JNIMain.h"

#include <fstream>
#include <utility>

#include <boost/unordered_map.hpp>
#include <boost/shared_ptr.hpp>
#include <boost/thread.hpp>
#include <boost/algorithm/string/replace.hpp>

#include "util/FileSystem.h"
#include "util/Guid.h"
#include "util/standardout.h"
#include "util/RobloxGoogleAnalytics.h"
#include "util/Http.h"
#include "util/Statistics.h"
#include "util/MemoryStats.h"
#include "v8datamodel/Stats.h"

#include "rbx/signal.h"

#include "FastLog.h"
#include "RbxAssert.h"

#include <android/log.h>

DYNAMIC_FASTINTVARIABLE(AndroidInfluxHundredthsPercentage, 0)


// Traditional Android macros.
#define LOG_TAG "roblox_jni"
#define LOG_INFO(...)  __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOG_WARNING(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOG_ERROR(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

#define CHANNEL_OUTPUT 1

using namespace RBX;

namespace RBX
{
namespace JNI
{
    extern std::string exceptionReasonFilename;  // set in JNIRobloxSettings.cpp
    std::string platformUserAgent;               // set in JNIRobloxSettings.cpp
    std::string robloxVersion;                   // set in JNIRobloxSettings.cpp
    extern int lastPlaceId;                         // set in JNIGLActivity.cpp
}
}

namespace
{
static bool cleanupCrashDumps;

std::string getFastLogGuid()
{
    std::string logGuid;
    RBX::Guid::generateStandardGUID(logGuid);
    logGuid = logGuid.substr(1, 6);
    return logGuid;
}

static void ResponseFunc(std::string* response, std::exception* exception) { }

static void standardOutCallback(const StandardOutMessage &msg)
{
    switch (msg.type)
    {
    case MESSAGE_OUTPUT:
    case MESSAGE_INFO:
        LOG_INFO("%s", msg.message.c_str());
        break;
    case MESSAGE_SENSITIVE:
    case MESSAGE_WARNING:
        LOG_WARNING("%s", msg.message.c_str());
        break;
    case MESSAGE_ERROR:
        LOG_ERROR("%s", msg.message.c_str());
        break;
    default:
        LOG_ERROR("Standard Message Out set with incorrect Message Type");
        break;
    }
}

static bool assertionHook(const char *expr, const char *filename, int lineNumber)
{
    StandardOut::singleton()->printf(MESSAGE_ERROR, "%s (%s:%d)", expr, filename, lineNumber);
    return true; // allow assertion handler to perform rawBreak.
}

class LogManager
{
    typedef boost::unordered_map<FLog::Channel, boost::shared_ptr<std::ostream> > Channels;

    boost::filesystem::path kLogPath;
    std::string kLogGuid;
    bool kInitialized;

    Channels channels;
    boost::mutex mutex;

    rbx::event_signals::scoped_connection messageOutConnection;
public:
    LogManager() : kInitialized(false)
    {
        messageOutConnection = StandardOut::singleton()->messageOut.connect(&standardOutCallback);
        StandardOut::singleton()->printf(MESSAGE_INFO, "StandardOut ready.");

        setAssertionHook(&assertionHook);
    }

    ~LogManager()
    {
        boost::mutex::scoped_lock lock(mutex);
        channels.clear(); // close all files and forget the file handles

        messageOutConnection.disconnect();
        LOG_INFO("StandardOut disconnected.");
    }

    void init(
            const boost::filesystem::path &logPath,
            const std::string &guid)
    {
        boost::mutex::scoped_lock lock(mutex);
        kLogPath = logPath;
        kLogGuid = guid;
        kInitialized = true;
    }

    void writeEntry(const FLog::Channel &channelId, const char *message)
    {
        RBXASSERT(kInitialized);

        boost::mutex::scoped_lock lock(mutex);

        const Channels::iterator it = channels.find(channelId);
        typename Channels::mapped_type stream;

        if (channels.end() == it)
        {
            const int kLogChannel = channelId;

            std::stringstream fileNameSS;
            fileNameSS << "log_" << kLogGuid << "_" << kLogChannel << ".txt";
            boost::filesystem::path path = kLogPath / fileNameSS.str();
            StandardOut::singleton()->printf(MESSAGE_INFO, "Opening log file at %s", path.c_str());
            typename Channels::value_type pair = std::make_pair(channelId, boost::shared_ptr<std::ostream>(new std::ofstream(path.c_str())));
            if (!pair.second)
            {
                std::stringstream ss;
                ss << "Could not open file: " << path.c_str();
                throw RBX::runtime_error(ss.str().c_str());
            }
            else
            {
                channels.insert(pair);
                stream = pair.second;
            }
        }
        else
        {
            stream = it->second;
        }

        *stream << message << '\n';
    }
}; // LogManager

static LogManager channels;

static void fastLogMessageCallback(FLog::Channel channelId, const char* message)
{
    switch (channelId)
    {
    case CHANNEL_OUTPUT:
        StandardOut::singleton()->printf(MESSAGE_INFO, "%s", message);
        break;
    default:
        channels.writeEntry(channelId, message);
        break;
    }
}
} // namespace

namespace RBX
{
namespace JNI
{
namespace LogManager
{
void setupFastLog()
{
    /*std::string logGuid = getFastLogGuid();
    StandardOut::singleton()->printf(MESSAGE_INFO, "LogManager::kLogGuid = %s", logGuid.c_str());

    std::string logPath = FileSystem::getCacheDirectory(true, "Log").string();
    StandardOut::singleton()->printf(MESSAGE_INFO, "LogManager::kLogPath = %s", logPath.c_str());

    channels.init(logPath, logGuid);

    FLog::SetExternalLogFunc(&fastLogMessageCallback);
    StandardOut::singleton()->printf(MESSAGE_INFO, "FastLog system ready.");*/
}

void tearDownFastLog()
{
    FLog::SetExternalLogFunc(NULL);
    StandardOut::singleton()->printf(MESSAGE_INFO, "FastLog system offline.");
}

void setupBreakpad(bool cleanup)
{
    StandardOut::singleton()->printf(MESSAGE_INFO, "Initializing breakpad.");
    cleanupCrashDumps = cleanup;
}
} // namespace LogManager
} // namespace JNI
} // namespace RBX

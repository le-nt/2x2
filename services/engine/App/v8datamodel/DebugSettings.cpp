/* Copyright 2003-2005 ROBLOX Corporation, All Rights Reserved */
#include "stdafx.h"

#include "v8datamodel/DebugSettings.h"
#include "v8datamodel/DataModel.h"
#include "util/Profiling.h"
#include "util/Http.h"
#include "script/LuaMemory.h"
#include "v8world/Block.h"
#include "v8datamodel/BlockMesh.h"
#include "rbx/RbxDbgInfo.h"

#include "util/RegistryUtil.h"

#include "rbx/SystemUtil.h"

#if defined(__APPLE__) || defined(__ANDROID__)
#include <sys/types.h>

#ifdef __APPLE__
#include <sys/sysctl.h>
#else
#include <linux/sysctl.h>
#endif

#include <sys/time.h>
#include <sys/resource.h>
#endif

const char *const RBX::sDebugSettings = "DebugSettings";
const char *const RBX::sTaskSchedulerSettings = "TaskScheduler";

using namespace RBX;

namespace RBX {
namespace Reflection {
template<>
EnumDesc<TaskScheduler::ThreadPoolConfig>::EnumDesc()
	:EnumDescriptor("ThreadPoolConfig")
{
	addPair(TaskScheduler::Auto, "Auto");
	addPair(TaskScheduler::PerCore1, "PerCore1");
	addPair(TaskScheduler::PerCore2, "PerCore2");
	addPair(TaskScheduler::PerCore3, "PerCore3");
	addPair(TaskScheduler::PerCore4, "PerCore4");
	addPair(TaskScheduler::Threads1, "Threads1");
	addPair(TaskScheduler::Threads2, "Threads2");
	addPair(TaskScheduler::Threads3, "Threads3");
	addPair(TaskScheduler::Threads4, "Threads4");
	addPair(TaskScheduler::Threads8, "Threads8");
	addPair(TaskScheduler::Threads16, "Threads16");
	addLegacy(201, "PartialThread", TaskScheduler::Auto);
}

template<>
EnumDesc<TaskScheduler::PriorityMethod>::EnumDesc()
	:EnumDescriptor("PriorityMethod")
{
	addPair(TaskScheduler::LastError, "LastError");
	addPair(TaskScheduler::AccumulatedError, "AccumulatedError");
	addPair(TaskScheduler::FIFO, "FIFO");
}

template<>
EnumDesc<TaskScheduler::Job::SleepAdjustMethod>::EnumDesc()
	:EnumDescriptor("SleepAdjustMethod")
{
	addPair(TaskScheduler::Job::None, "None");
	addPair(TaskScheduler::Job::LastSample, "LastSample");
	addPair(TaskScheduler::Job::AverageInterval, "AverageInterval");
}

template<>
EnumDesc<DebugSettings::ErrorReporting>::EnumDesc()
	:EnumDescriptor("ErrorReporting")
{
	addPair(DebugSettings::DontReport,"DontReport");
	addPair(DebugSettings::Prompt,"Prompt");
	addPair(DebugSettings::Report,"Report");
}

template<>
EnumDesc<EThrottle::EThrottleType>::EnumDesc()
	:EnumDescriptor("EnviromentalPhysicsThrottle")
{
	addPair(EThrottle::ThrottleDefaultAuto,"DefaultAuto");
	addPair(EThrottle::ThrottleDisabled,"Disabled");
	addPair(EThrottle::ThrottleAlways,"Always");
	addPair(EThrottle::Skip2,"Skip2");
	addPair(EThrottle::Skip4,"Skip4");
	addPair(EThrottle::Skip8,"Skip8");
	addPair(EThrottle::Skip16,"Skip16");
}

template<>
EnumDesc<Time::SampleMethod>::EnumDesc()
	:EnumDescriptor("TickCountSampleMethod")
{
	addPair(Time::Fast,"Fast");
	addPair(Time::Benchmark,"Benchmark");
	addPair(Time::Precise,"Precise");
}
}//namespace Reflection
}//namespace RBX

std::string DebugSettings::robloxVersion = "?";
std::string DebugSettings::robloxProductName = "?";

REFLECTION_BEGIN();
static Reflection::PropDescriptor<DebugSettings, std::string> prop_RobloxVersion("RobloxVersion", "Profile", &DebugSettings::getRobloxVersion, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_RobloxProductName("RobloxProductName", "Profile", &DebugSettings::getRobloxProductName, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, float> prop_getVertexShaderModel("VertexShaderModel", "Profile", &DebugSettings::getVertexShaderModel, &DebugSettings::imLazy123Float);
static Reflection::PropDescriptor<DebugSettings, float> prop_getPixelShaderModel("PixelShaderModel", "Profile", &DebugSettings::getPixelShaderModel, &DebugSettings::imLazy123Float);
static Reflection::PropDescriptor<DebugSettings, int> prop_videoMemory("VideoMemory", "Profile", &DebugSettings::videoMemory, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_cpuSpeed("CpuSpeed", "Profile", &DebugSettings::cpuSpeed, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_cpuCount("CpuCount", "Profile", &DebugSettings::cpuCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_osPlatformId("OsPlatformId", "Profile", &DebugSettings::osPlatformId, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_osPlatform("OsPlatform", "Profile", &DebugSettings::osPlatform, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_osVer("OsVer", "Profile", &DebugSettings::osVer, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, bool> prop_osIs64Bit("OsIs64Bit", "Profile", &DebugSettings::osIs64Bit, &DebugSettings::imLazy123Bool);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_systemProductName("SystemProductName", "Profile", &DebugSettings::systemProductName, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_gfxcard("GfxCard", "Profile", &DebugSettings::gfxcard, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_cpu("CPU", "Profile", &DebugSettings::cpu, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_simd("SIMD", "Profile", &DebugSettings::simd, &DebugSettings::imLazy123String);
static Reflection::PropDescriptor<DebugSettings, int> prop_ram("RAM", "Profile", &DebugSettings::totalPhysicalMemory, &DebugSettings::imLazy123Int); // alias of TotalPhysicalMemory for back-compat.
static Reflection::PropDescriptor<DebugSettings, int> prop_totalPhysicalMemory("TotalPhysicalMemory", "Profile", &DebugSettings::totalPhysicalMemory, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, std::string> prop_resolution("Resolution", "Profile", &DebugSettings::resolution, &DebugSettings::imLazy123String);
//PerfCounters
static Reflection::PropDescriptor<DebugSettings, int> prop_sfjsdlkfjlk("NameDatabaseSize", "Performance", &DebugSettings::nameDatabaseSize, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_sfjsdlkgflk("NameDatabaseBytes", "Performance", &DebugSettings::nameDatabaseBytes, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_availablePhysicalMemory("AvailablePhysicalMemory", "Performance", &DebugSettings::availablePhysicalMemory, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, double> prop_ElapsedTime("ElapsedTime", "Performance", &DebugSettings::getElapsedTime, &DebugSettings::imLazy123Double);
static Reflection::PropDescriptor<DebugSettings, double> prop_ProcessCores("ProcessCores", "Performance", &DebugSettings::processCores, &DebugSettings::imLazy123Double);
static Reflection::PropDescriptor<DebugSettings, int> prop_TotalProcessorTime("TotalProcessorTime", "Performance", &DebugSettings::totalProcessorTime, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_ProcessorTime("ProcessorTime", "Performance", &DebugSettings::processorTime, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_PrivateBytes("PrivateBytes", "Performance", &DebugSettings::privateBytes, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_PrivateWorkingSetBytes("PrivateWorkingSetBytes", "Performance", &DebugSettings::privateWorkingSetBytes, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_VirtualBytes("VirtualBytes", "Performance", &DebugSettings::GetVirtualBytes, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_PageFileBytes("PageFileBytes", "Performance", &DebugSettings::GetPageFileBytes, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_PageFaultsPerSecond("PageFaultsPerSecond", "Performance", &DebugSettings::GetPageFaultsPerSecond, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_InstanceCount("InstanceCount", "Performance", &DebugSettings::instanceCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_PlayerCount("PlayerCount", "Performance", &DebugSettings::getPlayerCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_DataModelCount("DataModel", "Performance", &DebugSettings::getDataModelCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_JobCount("JobCount", "Performance", &DebugSettings::jobCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_CdnSuccesses("CdnSuccessCount", "Performance", &DebugSettings::getCdnSuccessCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_CdnFailures("CdnFailureCount", "Performance", &DebugSettings::getCdnFailureCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_AltCdnSuccesses("AltCdnSuccessCount", "Performance", &DebugSettings::getAlternateCdnSuccessCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_AltCdnFailures("AltCdnFailureCount", "Performance", &DebugSettings::getAlternateCdnFailureCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_blockMeshMapSize("BlockMeshSize", "Performance", &DebugSettings::getBlockMeshMapCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, double> prop_LastCdnFailureTimeSpan("LastCdnFailureTimeSpan", "Performance", &DebugSettings::getLastCdnFailureTimeSpan, &DebugSettings::imLazy123Double);
static Reflection::PropDescriptor<DebugSettings, int> prop_robloxSuccesses("RobloxSuccessCount", "Performance", &DebugSettings::getRobloxSuccessCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, int> prop_robloxFailures("RobloxFailureCount", "Performance", &DebugSettings::getRobloxFalureCount, &DebugSettings::imLazy123Int);
static Reflection::PropDescriptor<DebugSettings, double> prop_robloxResponce("RobloxRespoceTime", "Performance", &DebugSettings::getRobloxResponce, &DebugSettings::imLazy123Double);
static Reflection::PropDescriptor<DebugSettings, double> prop_cdnReponce("CdnResponceTime", "Performance", &DebugSettings::getCdnRespoce, &DebugSettings::imLazy123Double);
static Reflection::BoundFuncDesc<DebugSettings, shared_ptr<const Reflection::Tuple>()> prop_ResetCdnFailures(&DebugSettings::resetCdnFailureCounts, "ResetCdnFailureCounts", Security::LocalUser);

// TODO: The setters here no longer do anying, get rid of these TaskSchedulerSettings!
static Reflection::PropDescriptor<TaskSchedulerSettings, int> prop_ThreadPoolSize("ThreadPoolSize", "Diagnostics", &TaskSchedulerSettings::threadPoolSize, &TaskSchedulerSettings::imLazy123TSettingsInt);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_threadAffinity("ThreadAffinity" , "Diagnostics", &TaskSchedulerSettings::threadAffinity, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_numSleepingJobs("NumSleepingJobs" , "Diagnostics", &TaskSchedulerSettings::numSleepingJobs, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_numWaitingJobs("NumWaitingJobs" , "Diagnostics", &TaskSchedulerSettings::numWaitingJobs, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_numRunningJobs("NumRunningJobs" , "Diagnostics", &TaskSchedulerSettings::numRunningJobs, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_messageRate("SchedulerRate" , "Diagnostics", &TaskSchedulerSettings::schedulerRate, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_messageDutyCycle("SchedulerDutyCycle" , "Diagnostics", &TaskSchedulerSettings::schedulerDutyCyclePerThread, &TaskSchedulerSettings::imLazy123TSettings);
static Reflection::BoundFuncDesc<TaskSchedulerSettings,void(bool, double)> func_AddDummyJob(&TaskSchedulerSettings::addDummyJob, "AddDummyJob", "exclusive", true, "fps", 30, Security::LocalUser);

Reflection::BoundProp<bool> prop_SoundWarnings("ReportSoundWarnings", "Errors", &DebugSettings::soundWarnings);
static Reflection::EnumPropDescriptor<DebugSettings, DebugSettings::ErrorReporting> prop_errorReporting("ErrorReporting", "Errors", &DebugSettings::getErrorReporting, &DebugSettings::setErrorReporting);
Reflection::BoundProp<bool> DebugSettings::prop_stackTracingEnabled("IsScriptStackTracingEnabled", "Errors", &DebugSettings::stackTracingEnabled);
Reflection::BoundProp<bool> DebugSettings::prop_reportExtendedMachineConfiguration("ReportExtendedMachineConfiguration", "Errors", &DebugSettings::reportExtendedMachineConfiguration);
Reflection::BoundFuncDesc<DebugSettings,void()> func_LegacyScriptMode(&DebugSettings::noOpt, "LegacyScriptMode", Security::LocalUser, Reflection::Descriptor::Attributes::deprecated());
Reflection::BoundFuncDesc<DebugSettings,void(bool)> func_BlockingRemove(&DebugSettings::setBlockingRemove, "SetBlockingRemove","value", Security::LocalUser);

static Reflection::EnumPropDescriptor<TaskSchedulerSettings, TaskScheduler::ThreadPoolConfig> prop_ThreadPool("ThreadPoolConfig", "Configuration", &TaskSchedulerSettings::getThreadPoolConfig, &TaskSchedulerSettings::setThreadPoolConfig);
static Reflection::BoundFuncDesc<TaskSchedulerSettings, void(double,int)> func_ThreadShare(&TaskSchedulerSettings::setThreadShare, "SetThreadShare", "timeSlice", "numShare", Security::LocalUser);
static Reflection::EnumPropDescriptor<TaskSchedulerSettings, TaskScheduler::PriorityMethod> prop_PriorityMethod("PriorityMethod", "Configuration", &TaskSchedulerSettings::getPriorityMethod, &TaskSchedulerSettings::setPriorityMethod);
static Reflection::EnumPropDescriptor<TaskSchedulerSettings, TaskScheduler::Job::SleepAdjustMethod> prop_SleepAdjustMethod("SleepAdjustMethod", "Configuration", &TaskSchedulerSettings::getSleepAdjustMethod, &TaskSchedulerSettings::setSleepAdjustMethod);
static Reflection::EnumPropDescriptor<TaskSchedulerSettings, DataModelArbiter::ConcurrencyModel> prop_ConcurrencyModel("Concurrency", "Configuration", &TaskSchedulerSettings::getConcurrencyModel, &TaskSchedulerSettings::setConcurrencyModel);
static Reflection::PropDescriptor<TaskSchedulerSettings, bool> prop_IsArbiterThrottled("AreArbitersThrottled", "Configuration", &TaskSchedulerSettings::getIsArbiterThrottled, &TaskSchedulerSettings::setIsArbiterThrottled);
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_ThrottledJobSleepTime("ThrottledJobSleepTime", "Configuration", &TaskSchedulerSettings::getThrottledJobSleepTime, &TaskSchedulerSettings::setThrottledJobSleepTime);

#if HANG_DETECTION
static Reflection::PropDescriptor<TaskSchedulerSettings, double> prop_StepTimeThreshold("StepTimeThreshold", "Configuration", &TaskSchedulerSettings::getStepTimeThreshold, &TaskSchedulerSettings::setStepTimeThreshold);
#endif

static Reflection::PropDescriptor<DebugSettings, bool> prop_Profiling("IsProfilingEnabled", "Benchmarking", &DebugSettings::getIsProfilingEnabled, &DebugSettings::setIsProfilingEnabled);
static Reflection::PropDescriptor<DebugSettings, double> prop_ProfilingWindow("ProfilingWindow", "Benchmarking", &DebugSettings::getProfilingWindow, &DebugSettings::setProfilingWindow);
static Reflection::EnumPropDescriptor<DebugSettings, Time::SampleMethod> prop_PrecisionOverride("TickCountPreciseOverride", "Benchmarking", &DebugSettings::getTickCountPreciseOverride, &DebugSettings::setTickCountPreciseOverride);
static Reflection::BoundProp<bool> prop_IsFmodProfilingEnabled("IsFmodProfilingEnabled", "Benchmarking", &DebugSettings::fmodProfiling);

static Reflection::PropDescriptor<DebugSettings, int> prop_LuaRamLimit("LuaRamLimit", "Limits", &DebugSettings::getLuaRamLimit, &DebugSettings::setLuaRamLimit);
REFLECTION_END();

DebugSettings::DebugSettings()
:stackTracingEnabled(true)
,errorReporting(Report)	// silently report, by default
,soundWarnings(false)
,fmodProfiling(false)
,reportExtendedMachineConfiguration(false)
,pixelShaderModel(0)
,vertexShaderModel(0)
,blockingRemove(false)
,enableProfiling(false)
{
	setName("Diagnostics");
}

int DebugSettings::getBlockMeshMapCount() const
{
	return RBX::Block::BlockMeshPool::getSize();
}

int DebugSettings::getLuaRamLimit() const
{
	return RBX::LuaAllocator::heapLimit;
}
void DebugSettings::setLuaRamLimit(int value)
{
	RBX::LuaAllocator::heapLimit = value;
}

class DummyArbiter : public TaskScheduler::Arbiter
{
	virtual std::string arbiterName()
	{
		return "DummyArbiter";
	}
	virtual bool areExclusive(TaskScheduler::Job* job1, TaskScheduler::Job* job2);
	virtual bool isThrottled()
	{
		return false;
	}
};

static shared_ptr<DummyArbiter> dummyArbiter(new DummyArbiter());

class DummyJob : public TaskScheduler::Job
{
public:
	const bool exclusive;
	const double fps;
	DummyJob(bool exclusive, double fps)
		:Job(RBX::format("DummyJob%s %gfps", exclusive ? "Exclusive" : "", fps).c_str(), dummyArbiter)
		,exclusive(exclusive)
		,fps(fps)
	  {}
	virtual Time::Interval sleepTime(const Stats& stats)
	{
		return Time::Interval(0);
	}

	virtual Job::Error error(const Stats& stats)
	{
		Job::Error result;
		result.error = fps * stats.timespanSinceLastStep.seconds();
		return result;
	}

	double getPriorityFactor()
	{
		return 1;
	}

	TaskScheduler::StepResult step(const Stats& stats)
	{
		return TaskScheduler::Stepped;
	}

};

bool DummyArbiter::areExclusive(TaskScheduler::Job* job1, TaskScheduler::Job* job2)
{
	if (static_cast<DummyJob*>(job1)->exclusive)
		return true;
	if (static_cast<DummyJob*>(job2)->exclusive)
		return true;
	return false;
}


void TaskSchedulerSettings::addDummyJob(bool exclusive, double fps)
{
}

TaskSchedulerSettings::TaskSchedulerSettings()
	:threadPoolConfig(TaskScheduler::Auto)
{
	setName("Task Scheduler");
}

TaskScheduler::ThreadPoolConfig TaskSchedulerSettings::getThreadPoolConfig() const 
{
	return threadPoolConfig;
}
void TaskSchedulerSettings::setThreadPoolConfig(TaskScheduler::ThreadPoolConfig value) 
{
	TaskScheduler::singleton().setThreadCount(value);
	if (value!=threadPoolConfig)
	{
		threadPoolConfig = value;
		raiseChanged(prop_ThreadPool);
	}
}

void TaskSchedulerSettings::setThreadShare(double timeSlice, int divisor)
{
	// deprecated
}

void TaskSchedulerSettings::setIsArbiterThrottled(bool value)
{
}

void TaskSchedulerSettings::setThrottledJobSleepTime(double value)
{
}

void TaskSchedulerSettings::setPriorityMethod(TaskScheduler::PriorityMethod value) 
{
}

void TaskSchedulerSettings::setSleepAdjustMethod(TaskScheduler::Job::SleepAdjustMethod value) 
{
}

void TaskSchedulerSettings::setConcurrencyModel(DataModelArbiter::ConcurrencyModel value) 
{
}

long DebugSettings::getDataModelCount() const
{
	return Diagnostics::Countable<DataModel>::getCount();
}

long DebugSettings::getPlayerCount() const
{
	return Diagnostics::Countable<Network::Player>::getCount();
}

long DebugSettings::getCdnSuccessCount() const
{
	return Http::cdnSuccessCount;
}
long DebugSettings::getCdnFailureCount() const
{
	return Http::cdnFailureCount;
}
long DebugSettings::getAlternateCdnSuccessCount() const
{
	return Http::alternateCdnSuccessCount;
}
long DebugSettings::getAlternateCdnFailureCount() const
{
	return Http::alternateCdnFailureCount;
}
long DebugSettings::getRobloxSuccessCount() const
{
	return Http::robloxSuccessCount;
}
long DebugSettings::getRobloxFalureCount() const
{
	return Http::robloxFailureCount;
}
double DebugSettings::getRobloxResponce() const
{
	if (!Http::getRobloxResponceLock())
	{
		return 0;
	}
	RBX::mutex::scoped_lock lock(*Http::getRobloxResponceLock());
	return Http::robloxResponce.getStats().average;
}

double DebugSettings::getCdnRespoce() const
{
	if (!Http::getCdnResponceLock())
	{
		return 0;
	}
	RBX::mutex::scoped_lock lock(*Http::getCdnResponceLock());
	return Http::cdnResponce.getStats().average;
}

shared_ptr<const Reflection::Tuple> DebugSettings::resetCdnFailureCounts()
{
	shared_ptr<Reflection::Tuple> result(new Reflection::Tuple(9));
	result->values[0] = Http::cdnSuccessCount.swap(0);
	result->values[1] = Http::cdnFailureCount.swap(0);
	result->values[2] = Http::alternateCdnSuccessCount.swap(0);
	result->values[3] = Http::alternateCdnFailureCount.swap(0);
	result->values[4] = Http::robloxSuccessCount.swap(0);
	result->values[5] = Http::robloxFailureCount.swap(0);

	{
		if (Http::getRobloxResponceLock())
		{
			RBX::mutex::scoped_lock lock(*Http::getRobloxResponceLock());
			result->values[6] = Http::robloxResponce.getStats().average;
			Http::robloxResponce.clear();
		}
		else
		{
			result->values[6] = 0;
		}
	}

	{
		if (Http::getCdnResponceLock())
		{
			RBX::mutex::scoped_lock lock(*Http::getCdnResponceLock());
			result->values[7] = Http::cdnResponce.getStats().average;
			Http::cdnResponce.clear();
		}
		else
		{
			result->values[7] = 0;
		}
	}

	result->values[8] = (Http::lastCdnFailureTimeSpan);
	Http::lastCdnFailureTimeSpan = 0;

	return result;
}

double DebugSettings::getLastCdnFailureTimeSpan() const
{
	return Http::lastCdnFailureTimeSpan;
}

bool DebugSettings::getIsProfilingEnabled() const
{
	return Profiling::isEnabled();
}
void DebugSettings::setIsProfilingEnabled(bool value)
{
	Profiling::setEnabled(value);
}
double DebugSettings::getProfilingWindow() const
{
	return Profiling::Profiler::profilingWindow;
}
void DebugSettings::setProfilingWindow(double value)
{
	Profiling::Profiler::profilingWindow = value;
}

void DebugSettings::setErrorReporting(ErrorReporting value) 
{
	if (value != errorReporting) {
		errorReporting = value;
		raiseChanged(prop_errorReporting);
	}
}


float DebugSettings::getPixelShaderModel() const
{
	return pixelShaderModel;
}
float DebugSettings::getVertexShaderModel() const
{
	return vertexShaderModel;
}

void DebugSettings::setPixelShaderModel(float v) 
{
	pixelShaderModel = v;
}
void DebugSettings::setVertexShaderModel(float v)
{
	vertexShaderModel = v;
}

int DebugSettings::videoMemory() const
{
	return SystemUtil::getVideoMemory();
}
int DebugSettings::cpuSpeed() const
{
	return 0;
}
int DebugSettings::cpuCount() const
{
	return 1;
}

std::string DebugSettings::osVer() const
{
    return SystemUtil::osVer();
}

int DebugSettings::osPlatformId() const
{
	// TODO: Nuke this property!
    return SystemUtil::osPlatformId();
}

std::string DebugSettings::osPlatform() const
{
    return SystemUtil::osPlatform();
}

std::string DebugSettings::deviceName() const
{
    return SystemUtil::deviceName();
}

bool DebugSettings::osIs64Bit() const
{
    return SystemUtil::isCPU64Bit();
}

std::string DebugSettings::systemProductName() const
{
	return "?";
}

std::string DebugSettings::gfxcard() const
{
    return SystemUtil::getGPUMake();
}
std::string DebugSettings::cpu() const
{
	return "";
}
std::string DebugSettings::simd() const
{
	if (G3D::System::hasSSE3())
		return "SSE3";
	if (G3D::System::hasSSE2())
		return "SSE2";
	if (G3D::System::hasSSE())
		return "SSE";
	return "None";
}

int DebugSettings::totalPhysicalMemory() const
{
	return 0;
}

int DebugSettings::availablePhysicalMemory() const
{
    return 0;
}

std::string DebugSettings::resolution() const
{
	return "";
}

double DebugSettings::processCores() const
{
	return -1;
}


double DebugSettings::getElapsedTime() const
{
	return -1;
}

int DebugSettings::totalProcessorTime() const
{
	return -1;

}

int DebugSettings::processorTime() const
{
	return -1;
}

int DebugSettings::privateBytes() const
{
	return -1;

}

int DebugSettings::privateWorkingSetBytes() const
{
	return -1;

}

int DebugSettings::GetVirtualBytes() const
{
	return -1;

}

int DebugSettings::GetPageFileBytes() const
{
	return -1;
}

int DebugSettings::GetPageFaultsPerSecond() const
{
	return -1;

}


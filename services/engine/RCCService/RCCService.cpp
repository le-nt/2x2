// RCCService.cpp : Defines the entry point for the console application.
//


#include <iostream>
#include <atomic>
#include <cstdlib>
#include <thread>

#include "gSOAP/generated/RCCServiceSoap.nsmap"
#include "gSOAP/generated/soapRCCServiceSoapService.h"
#include "rbx/Boost.hpp"
#include "util/standardout.h"
#include "rbx/TaskScheduler.h"
#include "util/Statistics.h"
#include "util/Http.h"
#include "v8datamodel/DataModel.h"
#include "OperationalSecurity.h"

#pragma optimize( "", off ) 

static std::atomic<long> requestCount = 0;
extern std::atomic<long> diagCount;
extern std::atomic<long> batchJobCount;
extern std::atomic<long> openJobCount;
extern std::atomic<long> closeJobCount;
extern std::atomic<long> helloWorldCount;
extern std::atomic<long> getVersionCount;
extern std::atomic<long> renewLeaseCount;
extern std::atomic<long> executeCount;
extern std::atomic<long> getExpirationCount;
extern std::atomic<long> getStatusCount;
extern std::atomic<long> getAllJobsCount;
extern std::atomic<long> closeExpiredJobsCount;
extern std::atomic<long> closeAllJobsCount;

#ifdef RBX_TEST_BUILD
extern std::string RCCServiceSettingsKeyOverwrite;
#endif

void process_request(RCCServiceSoapService *service) 
{ 
	requestCount++;
	try
	{
		service->serve(); 
		delete service;
	}
	catch (...)
	{
		RBXCRASH();
	}
	requestCount--;
} 

static void StringCrash(const char* s)
{
	//char str[256];
	//strncpy_s(str, 256, s, 256);
	RBXCRASH();
}

template <class Soap>
class ExceptionAwareSoap : public Soap
{
public:
	virtual	int dispatch()
	{
		try
		{
			//printf("%s\n", action); 
			return Soap::dispatch();
		}
		catch (std::exception& e)
		{
			return soap_receiver_fault(this, e.what(), NULL); // return fault to sender 
		}
		catch (std::string& s)
		{
			StringCrash(s.c_str());
			return soap_receiver_fault(this, s.c_str(), NULL); // return fault to sender 
		}
		catch (...)
		{
			RBXCRASH();
			return soap_receiver_fault(this, "Unexpected C++ exception type", NULL); // return fault to sender 
		}
	}
	virtual	RCCServiceSoapService *copy()
	{
		ExceptionAwareSoap<Soap> *dup = new ExceptionAwareSoap<Soap>();
		soap_copy_context(dup, this);
		return dup;	
	}
};


ExceptionAwareSoap<RCCServiceSoapService> service; 

void start_CWebService(const std::string& contentpath, bool crashUploaderOnly);

static void startupRCC(int port, const std::string& contentpath, bool crashUploaderOnly)
{
	printf("Service starting...\n"); 

	start_CWebService(contentpath, crashUploaderOnly);

  //service.send_timeout = 60; // 60 seconds 
  //service.recv_timeout = 60; // 60 seconds 
  service.accept_timeout = 1; // server stops after 1 second
  //soap.max_keep_alive = 100; // max keep-alive sequence 
  SOAP_SOCKET m = service.bind(NULL, port, 100); 
  if (!soap_valid_socket(m)) 
	  throw std::runtime_error(*soap_faultstring(&service)); 

	char buffer[64];
	sprintf_s(buffer, 64, "Service Started on port %d", port); 
	RBX::StandardOut::singleton()->print(RBX::MESSAGE_SENSITIVE, buffer);
}

void process_request_func(RCCServiceSoapService* param)
{
    process_request(param);
}

static void stepRCC()
{
	if (requestCount>100)
		throw std::runtime_error(RBX::format(
			"%d outstanding requests, execute=%d, openJob=%d, batchJob=%d, diag=%d, getVersion=%d, renewLease=%d, getAllJobs=%d, getStatusCount=%d, closeExpiredJobs=%d, closeJob=%d, helloWorld=%d, getExpiration=%d, closeAllJobs=%d", 
			requestCount.load(), executeCount.load(), openJobCount.load(), batchJobCount.load(), diagCount.load(), 
			getVersionCount.load(), renewLeaseCount.load(), getAllJobsCount.load(), getStatusCount.load(), 
			closeExpiredJobsCount.load(), closeJobCount.load(), helloWorldCount.load(), getExpirationCount.load(), closeAllJobsCount.load()));

	SOAP_SOCKET s = service.accept(); 
	if (!soap_valid_socket(s)) 
	{ 
		if (service.errnum)
			throw std::runtime_error(*soap_faultstring(&service)); 
		return;
	} 

	RCCServiceSoapService* copy = service.copy(); // make a safe copy 
	if (!copy) 
		throw std::runtime_error(*soap_faultstring(&service)); 

	try {
		std::thread(process_request_func, copy).detach();
	} catch (const std::system_error& e) {
		fprintf(stderr, "Thread creation failed: %s\n", e.what());
	}
}

void stop_CWebService();

static void shutdownRCC()
{
	printf("Service shutting down...\n"); 
	stop_CWebService();
}

static std::string parse(const std::string& tag, int argc, char* argv[]) {
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];

        if (!arg.empty() && arg[0] == '/')
            arg[0] = '-';

        if (arg.size() >= tag.size() &&
            std::equal(tag.begin(), tag.end(), arg.begin(),
                       [](char a, char b) { return std::tolower(a) == std::tolower(b); }))
        {
            return arg.substr(tag.size());
        }
    }

    return "";
}

static std::string parseContent(int argc, char* argv[]) {
    const std::string tag = "-Content:";
    std::string result = parse(tag, argc, argv);
    return result.empty() ? "Content/" : result;
}

static std::string parseBaseUrl(int argc, char* argv[]) {
    const std::string tag = "-BaseUrl:";
    std::string result = parse(tag, argc, argv);
    return result.empty() ? "" : result;
}

static int parsePort(int argc, char* argv[]) {
    int port = 64989;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (!arg.empty() && (arg[0] == '/' || arg[0] == '-'))
            continue;
        port = std::atoi(arg.c_str());
    }
    return port;
}

static int parsePlaceId(int argc, char* argv[]) {
    std::string result = parse("-PlaceId:", argc, argv);
    if (result.empty())
        return -1;
    return std::atoi(result.c_str());
}

namespace RBX {
	extern bool nameThreads;
}

static boost::mutex keyLockMutex;

void ReadAccessKey()
{
	if (RBX::Http::accessKey.empty())
	{
		const char* envKey = std::getenv("RBX_ACCESS_KEY");
		if (envKey && *envKey)
		{
			RBX::Http::accessKey = std::string(envKey);
			RBX::StandardOut::singleton()->printf(
				RBX::MESSAGE_SENSITIVE, "Got access key: %s", RBX::Http::accessKey.c_str());
		}
		else
		{
			RBX::StandardOut::singleton()->printf(
				RBX::MESSAGE_WARNING, "No access key has been set!");
		}
	}
	else
	{
		RBX::StandardOut::singleton()->printf(
			RBX::MESSAGE_SENSITIVE, "Current access key: %s", RBX::Http::accessKey.c_str());
	}
}

class PrintfLogger
{
	rbx::event_signals::scoped_connection messageConnection;
	std::mutex mutex;
public:
	PrintfLogger()
	{
		messageConnection = RBX::StandardOut::singleton()->messageOut.connect(boost::bind(&PrintfLogger::onMessage, this, _1));
	}
protected:
	void onMessage(const RBX::StandardOutMessage& message)
	{
		std::lock_guard<std::mutex> lock(mutex);

		const char* colorCode;

		switch (message.type)
		{
		case RBX::MESSAGE_OUTPUT:
			colorCode = "\033[1;34m";
			break;
		case RBX::MESSAGE_INFO:
			colorCode = "\033[0m";
			break;
		case RBX::MESSAGE_WARNING:
			colorCode = "\033[1;33m";
			break;
		case RBX::MESSAGE_ERROR:
			colorCode = "\033[1;31m";
			break;
		default:
			colorCode = "\033[0m";
			break;
		}

		std::cout << colorCode << message.message << "\033[0m" << std::endl;
	}
};


int main(int argc, char* argv[])
{
	static boost::scoped_ptr<PrintfLogger> standardOutLog(new PrintfLogger());
	ReadAccessKey();

	std::string baseUrl = parseBaseUrl(argc, argv);
	SetBaseURL(baseUrl);

	try
	{
		startupRCC(parsePort(argc, argv), parseContent(argc, argv), false);

		int placeId = parsePlaceId(argc, argv);
		if (placeId > -1)
		{
			std::stringstream buffer;
			std::ifstream gameServerFile("gameserver.txt", std::ios::in);
			if (gameServerFile.is_open())
			{
				buffer << gameServerFile.rdbuf();
				gameServerFile.close();
			}

			buffer << "start(" << placeId << ", " << 53640 << ", '" << GetBaseURL() << "')";
			std::string script = buffer.str();

			RCCServiceSoapService* copy = service.copy(); // make a safe copy 
			if (!copy) 
				throw std::runtime_error(*soap_faultstring(&service)); 

			ns1__Job job;
			job.id = "Test";
			job.expirationInSeconds = 600;

			ns1__ScriptExecution se;
			static std::string scriptName = "Start Server";
			se.name = &scriptName;
			se.script = &script;

			_ns1__OpenJob openJob;
			_ns1__OpenJobResponse response;
			openJob.script = &se;
			openJob.job = &job;

			copy->OpenJob(&openJob, &response);
		}

		while(true) // TODO: add some form of graceful shutdown like a ctrl c
		{
			stepRCC();
		}
		shutdownRCC();
	}
	catch (std::exception& e)
	{
		RBX::StandardOut::singleton()->print(RBX::MESSAGE_ERROR, e);
	}
    RBX::clearLuaReadOnly();
}

#pragma optimize( "", on )

/* Copyright 2003-2006 ROBLOX Corporation, All Rights Reserved */


// third time's the charm
#include "network/api.h"
#include "Client.h"
#include "Server.h"
#include "ServerReplicator.h"
#include "ClientReplicator.h"
#include "Players.h"
#include "Player.h"
#include "Marker.h"
#include "util/Http.h"
#include "NetworkSettings.h"
#include "v8datamodel/DataModel.h"
#include "v8datamodel/GlobalSettings.h"
#include "v8datamodel/HackDefines.h"
#include "v8datamodel/Workspace.h"
#include "GuidRegistryService.h"
#include "RakNetVersion.h"
#include "util/Utilities.h"
#include "FastLog.h"

// RakNet
#include "StringCompressor.h"
#include "StringTable.h"

#include "VirtualizerSDK.h"

#include <boost/algorithm/string.hpp>

FASTSTRINGVARIABLE(ClientExternalBrowserUserAgent, "Roblox/WinInet")

#pragma comment (lib, "Ws2_32.lib")

std::string RBX::Network::versionB;
std::string RBX::Network::securityKey;
unsigned int RBX::initialProgramHash = 0;

#if RAKNET_PROTOCOL_VERSION!=5
#error
#endif


RBX_REGISTER_CLASS(RBX::Network::Client);
RBX_REGISTER_CLASS(RBX::Network::Server);
RBX_REGISTER_CLASS(RBX::Network::Player);
RBX_REGISTER_CLASS(RBX::Network::Players);
RBX_REGISTER_CLASS(RBX::NetworkSettings);
RBX_REGISTER_CLASS(RBX::Network::Peer);
RBX_REGISTER_CLASS(RBX::Network::Marker);
RBX_REGISTER_CLASS(RBX::Network::Replicator);
RBX_REGISTER_CLASS(RBX::Network::ServerReplicator);
RBX_REGISTER_CLASS(RBX::Network::ClientReplicator);
RBX_REGISTER_CLASS(RBX::Network::GuidRegistryService);

RBX_REGISTER_ENUM(PacketPriority);
RBX_REGISTER_ENUM(PacketReliability);
RBX_REGISTER_ENUM(RBX::Network::FilterResult);
RBX_REGISTER_ENUM(RBX::Network::Player::MembershipType);
RBX_REGISTER_ENUM(RBX::Network::Player::ChatMode);
RBX_REGISTER_ENUM(RBX::Network::Players::PlayerChatType);
RBX_REGISTER_ENUM(RBX::Network::Players::ChatOption);
RBX_REGISTER_ENUM(RBX::NetworkSettings::PhysicsSendMethod);
RBX_REGISTER_ENUM(RBX::NetworkSettings::PhysicsReceiveMethod);

namespace RBX {
	namespace Network {
		// Prevent string compressors from being created at the same time
		class SafeInitFree
		{
		public:
			SafeInitFree()
			{
				RakNet::StringCompressor::AddReference();
				RakNet::StringTable::AddReference();
			}
			~SafeInitFree()
			{
				RakNet::StringCompressor::RemoveReference();
				RakNet::StringTable::RemoveReference();
			}
		};
	}
}

static bool _isPlayerAuthenticationEnabled;

bool RBX::Network::isPlayerAuthenticationEnabled()
{
	return _isPlayerAuthenticationEnabled;
}

bool RBX::Network::isNetworkClient(const Instance* context)
{
	return ServiceProvider::find<Client>(context) != NULL;
}

#if defined(RBX_RCC_SECURITY)
static shared_ptr<RBX::Network::ServerReplicator> createSecureReplicator(RakNet::SystemAddress a, RBX::Network::Server* s, RBX::NetworkSettings* networkSettings)
{
    return boost::static_pointer_cast<RBX::Network::ServerReplicator>(
        RBX::Creatable<RBX::Instance>::create<RBX::Network::CheatHandlingServerReplicator>(a, s, networkSettings)
    );
}
#endif

static void initVersion1()
{
	VIRTUALIZER_START
	// security key: generated externally (version+platform+product+salt), modify per release, send from client to server

#if (defined(_WIN32) && (defined(LOVE_ALL_ACCESS) || defined(_NOOPT) || defined(_DEBUG) || defined(RBX_TEST_BUILD))) || (defined(__APPLE__) && defined(__arm__)) || defined(__ANDROID__) || (defined(__APPLE__) && defined(__aarch64__)) || defined(RBX_PLATFORM_DURANGO) || defined(EMSCRIPTEN) || defined(__unix__)
	// If we are Apple iOS, Android, or if we are Windows noopt/debug/test, use this fixed key:
	// INTERNALiosapp, 2e427f51c4dab762fe9e3471c6cfa1650841723b
	RBX::Network::securityKey = RBX::rot13("2r427s51p4qno762sr9r3471p6psn1650841723o");
#elif defined(_WIN32)
	//0.235.0pcplayeraskljfLUZF, sha1: 2d83a36443889941b170fe68cfe3cc6d718b1abb, then rot13 and put below
	RBX::Network::securityKey = RBX::rot13("2q83n36443889941o170sr68psr3pp6q718o1noo");
#elif defined(__APPLE__)
	//0.235.0macplayeraskljfLUZF, sha1: a7377e56dedd0d8e0fecafbec93cf00f0b2edca1, then rot13 and put below
	RBX::Network::securityKey = RBX::rot13("n7377r56qrqq0q8r0srpnsorp93ps00s0o2rqpn1");
#else
    #error "Unsupported platform"
#endif

	RBX::Network::versionB += '7';
	RBX::Network::versionB += (char)79;
	VIRTUALIZER_END
}

static void initVersion2()
{
	// TODO: Obfuscate even more?
	RBX::Network::versionB += "l";
	RBX::Network::versionB += 'E';
}



void RBX::Network::initWithServerSecurity()
{
	initVersion1();
	initWithoutSecurity();
#if defined(RBX_RCC_SECURITY)
	_isPlayerAuthenticationEnabled = true;
	Server::createReplicator = createSecureReplicator;
#endif
	initVersion2();
}


void RBX::Network::initWithPlayerSecurity()
{
	initVersion1();
	initWithoutSecurity();
	initVersion2();
}

void RBX::Network::initWithCloudEditSecurity()
{
	// Keep this in sync with initWithoutSecurity password
	versionB = "";
	versionB += "^";
	versionB += (char)17;
}

void RBX::Network::initWithoutSecurity()
{
	VIRTUALIZER_START
	_isPlayerAuthenticationEnabled = false;

	static SafeInitFree safeInitFree;

	// Forces registration of Descriptors
	Client::classDescriptor();
	Server::classDescriptor();
	versionB += "^";
	Player::classDescriptor();
	Players::classDescriptor();
	GlobalAdvancedSettings::classDescriptor();
	NetworkSettings::classDescriptor();
	versionB += (char)17;

	// Force instantiation of NetworkSettings singleton
	NetworkSettings::singleton();
	VIRTUALIZER_END
}

void RBX::Network::setVersion(const char* version)
{
	if (version)
		versionB = version;
}

void RBX::Network::setSecurityVersions(const std::vector<std::string>& versions)
{
	Server::setAllowedSecurityVersions(versions);
}

bool RBX::Network::isTrustedContent(const char* url)
{
	return Http::isRobloxSite(url);
}
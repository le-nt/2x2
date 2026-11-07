#include "stdafx.h"

#include "RobloxServicesTools.h"
#include "util/URL.h"
#include "format_string.h"
#include <boost/algorithm/string/predicate.hpp>
#include <sstream>

#define DEFAULT_URL_SCHEMA "https"

std::string trim_trailing_slashes(const std::string &path) 
{
	size_t i = path.find_last_not_of('/');
	return path.substr(0, i+1);
}

static std::string BuildGenericApiUrl(const std::string &baseUrl, const std::string &serviceNameIn, const std::string &path, const std::string &key, const char* scheme = "https")
{
    std::string serviceName(serviceNameIn);
    if (serviceName != "")
    {
        serviceName += ".";
    }
    else
    {
        serviceName = "www.";
    }

    const RBX::Url baseUrlParsed = RBX::Url::fromString(baseUrl);
	return format_string("https://%s%s/%s", serviceName.c_str(), baseUrlParsed.domain().c_str(), path.c_str());
}

std::string GetCountersUrl(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "v1.1/Counters/Increment", key, DEFAULT_URL_SCHEMA);
}

std::string GetCountersMultiIncrementUrl(const std::string &baseUrl, const std::string &key)
{
    return BuildGenericApiUrl(baseUrl, "", "v1.0/MultiIncrement", key, DEFAULT_URL_SCHEMA);
}

std::string GetSettingsUrl(const std::string &baseUrl, const std::string &group, const std::string &key)
{
    return BuildGenericApiUrl(baseUrl, "clientsettingscdn", format_string("%s.json", group.c_str()), key, DEFAULT_URL_SCHEMA);
}

std::string GetSecurityKeyUrl(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "api/internal/gameserver/versions", key);
}

std::string GetSecurityKeyUrl2(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "GetAllowedSecurityKeys", key);
}

// used by bootstrapper
std::string GetClientVersionUploadUrl(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "GetCurrentClientVersionUpload", key);
}

std::string GetPlayerGameDataUrl(const std::string &baseurl, int userId, const std::string &key)
{
	return BuildGenericApiUrl(baseurl, "", format_string("api/game/players/%d", userId), key);
}

std::string GetWebChatFilterURL(const std::string& baseUrl, const std::string& key)
{
	return BuildGenericApiUrl(baseUrl, "", "api/moderation/filtertext", key);
}

std::string GetMD5HashUrl(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "api/internal/gameserver/hashes", key);
}

std::string GetMemHashUrl(const std::string &baseUrl, const std::string &key)
{
	return BuildGenericApiUrl(baseUrl, "", "GetAllowedMemHashes", key);
}

std::string GetGridUrl(const std::string &anyUrl, bool changeToDataDomain)
{
    std::string url = trim_trailing_slashes(anyUrl);
	if (changeToDataDomain)
		url = ReplaceTopSubdomain(url, "data");

    url = url + "/Error/Grid.ashx";
    return url;
}

std::string GetDmpUrl(const std::string &anyUrl, bool changeToDataDomain)
{
    std::string url = trim_trailing_slashes(anyUrl);
	if (changeToDataDomain)
		url = ReplaceTopSubdomain(url, "data");
    
	url = url + "/Error/Dmp.ashx";
    return url;
}

std::string GetBreakpadUrl(const std::string &anyUrl, bool changeToDataDomain)
{
    std::string url = trim_trailing_slashes(anyUrl);
	if (changeToDataDomain)
		url = ReplaceTopSubdomain(url, "data");

	url = url + "/Error/Breakpad.ashx";
    return url;
}

std::string ReplaceTopSubdomain(const std::string& anyUrl, const char* newTopSubDoman)
{
    /*std::string result(anyUrl);
    std::size_t foundPos = result.find("www.");
    if (foundPos != std::string::npos)
    {
        result.replace(foundPos, 3, newTopSubDoman);
    }
    else if ((foundPos = result.find("m.")) != std::string::npos)
    {
        result.replace(foundPos, 1, newTopSubDoman);
    }
    return result;*/
    return anyUrl;
}

std::string BuildGenericPersistenceUrl(const std::string& baseUrl, const std::string &servicePath)
{
    std::string constructedURLDomain(baseUrl);
    std::string constructedServicePath(servicePath);

	constructedURLDomain = ReplaceTopSubdomain(constructedURLDomain, "gamepersistence");
    if (!boost::algorithm::ends_with(constructedURLDomain, "/"))
    {
        constructedURLDomain.append("/");
    }
    return constructedURLDomain + constructedServicePath + "/" ;
}

std::string BuildGenericGameUrl(const std::string& baseUrl, const std::string &servicePath)
{
    std::string constructedURLDomain(baseUrl);
    std::string constructedServicePath(servicePath);
	
	constructedURLDomain = ReplaceTopSubdomain(constructedURLDomain, "assetgame");
    if (!boost::algorithm::ends_with(constructedURLDomain, "/"))
    {
        constructedURLDomain.append("/");
    }
    if (boost::algorithm::starts_with(constructedServicePath, "/"))
    {
        constructedServicePath.erase(constructedServicePath.begin());
    }
    return constructedURLDomain + constructedServicePath;
}


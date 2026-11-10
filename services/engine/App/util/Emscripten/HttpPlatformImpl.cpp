#include "util/HttpPlatformImpl.h"
#include "util/Http.h"
#include <string>
#include <vector>
#include <sstream>
#include <stdexcept>
#include <cstring>
#include <emscripten/fetch.h>
#include <emscripten/websocket.h>
#include <boost/filesystem.hpp>

LOGGROUP(Http)
DYNAMIC_LOGGROUP(HttpTrace)

using namespace RBX;
using namespace RBX::HttpPlatformImpl;

namespace RBX
{
namespace HttpPlatformImpl
{
    EMSCRIPTEN_WEBSOCKET_T ws_conn;
    void setProxy(const std::string& host, long port)
    {}

    void init(Http::CookieSharingPolicy cookieSharingPolicy)
    {}

    void setCookiesForDomain(const std::string& domain, const std::string& cookies)
    {}

    void setCookiesForDomain(const std::string& domain, std::string& cookies)
    {}

    boost::filesystem::path getRobloxCookieJarPath()
    {
        return "";
    }

    // Legacy 2016 models, decals and meshes often request Roblox's historical
    // numeric asset endpoint. In the browser client, resolve these through
    // 2x2's same-origin native asset endpoint instead of crossing origins.
    // Only exact Roblox asset host/path matches with a numeric ID are eligible.
    static std::string localLegacyAssetUrl(const std::string& url)
    {
        static const char* prefixes[] = {
            "http://www.roblox.com/asset?", "https://www.roblox.com/asset?",
            "http://www.roblox.com/asset/?", "https://www.roblox.com/asset/?",
            "http://roblox.com/asset?", "https://roblox.com/asset?",
            "http://roblox.com/asset/?", "https://roblox.com/asset/?",
            "http://www.projectpizza.net/api/asset?", "https://www.projectpizza.net/api/asset?",
            "http://www.projectpizza.net/api/asset/?", "https://www.projectpizza.net/api/asset/?",
            "http://projectpizza.net/api/asset?", "https://projectpizza.net/api/asset?",
            "http://projectpizza.net/api/asset/?", "https://projectpizza.net/api/asset/?"
        };
        for (unsigned int i = 0; i < sizeof(prefixes) / sizeof(prefixes[0]); ++i)
        {
            const std::string prefix(prefixes[i]);
            if (url.compare(0, prefix.size(), prefix) != 0) continue;
            const std::string query = url.substr(prefix.size());
            std::string::size_type start = 0;
            while (start < query.size())
            {
                const std::string::size_type end = query.find('&', start);
                const std::string field = query.substr(start, end == std::string::npos
                    ? std::string::npos : end - start);
                if (field.compare(0, 3, "id=") == 0)
                {
                    const std::string id = field.substr(3);
                    if (id.empty() || id.size() > 15 || id[0] == '0') return url;
                    bool numeric = true;
                    for (std::string::size_type j = 0; j < id.size(); ++j)
                        if (id[j] < '0' || id[j] > '9') { numeric = false; break; }
                    if (numeric) return "/native/content-asset?id=" + id;
                    return url;
                }
                if (end == std::string::npos) break;
                start = end + 1;
            }
        }
        return url;
    }

    void perform(HttpOptions& options, std::string& response)
    {
        emscripten_fetch_attr_t attr;
        emscripten_fetch_attr_init(&attr);
        attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY | EMSCRIPTEN_FETCH_SYNCHRONOUS;

        if (options.postData)
        {
            strcpy(attr.requestMethod, "POST");
        }
        else
        {
            strcpy(attr.requestMethod, "GET");
        }

        // Keep body/header storage alive for this synchronous fetch, including workers.
        std::string requestBody;
        if (options.postData) {
            std::ostringstream stream;
            stream << options.postData->rdbuf();
            requestBody = stream.str();
            attr.requestData = requestBody.data();
            attr.requestDataSize = requestBody.size();
        }
        std::vector<std::string> headerStorage;
        if (options.hdrContentType && !options.hdrContentType->empty()) {
            headerStorage.push_back("Content-Type");
            headerStorage.push_back(*options.hdrContentType);
        }
        if (options.addlHeaders) for (const auto& header : *options.addlHeaders) {
            headerStorage.push_back(header.first);
            headerStorage.push_back(header.second);
        }
        std::vector<const char*> requestHeaders;
        for (const auto& value : headerStorage) requestHeaders.push_back(value.c_str());
        requestHeaders.push_back(nullptr);
        attr.requestHeaders = requestHeaders.data();
        attr.withCredentials = EM_TRUE;
        attr.timeoutMSecs = options.performTimeoutMillis > 0 ? options.performTimeoutMillis : 60000;
        const std::string requestUrl = localLegacyAssetUrl(options.url);
        emscripten_fetch_t *fetch = emscripten_fetch(&attr, requestUrl.c_str());
        if (!fetch) throw std::runtime_error("Native HTTP request could not be created");
        long statusCode = fetch->status;

        if (statusCode < 200 || statusCode > 308 || statusCode == 202)
        {
            emscripten_fetch_close(fetch);
            throw RBX::http_status_error(statusCode, "");
        }
        else
        {
            response.assign(fetch->data, fetch->numBytes);
        }

        emscripten_fetch_close(fetch);
    }
} // namespace HttpPlatformImpl
} // namespace RBX
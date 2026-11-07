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
        emscripten_fetch_t *fetch = emscripten_fetch(&attr, options.url.c_str());
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
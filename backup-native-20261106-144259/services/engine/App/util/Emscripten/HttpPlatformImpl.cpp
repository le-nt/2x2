#include "util/HttpPlatformImpl.h"
#include "util/Http.h"
#include <string>
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

        emscripten_fetch_t *fetch = emscripten_fetch(&attr, options.url.c_str());
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
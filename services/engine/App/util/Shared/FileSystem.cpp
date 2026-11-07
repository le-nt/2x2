#include "util/FileSystem.h"
#include <boost/filesystem.hpp>
#include <boost/system/error_code.hpp>
#include <cstdio>

namespace RBX {
namespace FileSystem {

#ifndef ANDROID
boost::filesystem::path getUserDirectory(bool create, FileSystemDir dir, const char* subDirectory)
{
    boost::filesystem::path basePath;

    #ifdef EMSCRIPTEN
        switch(dir)
        {
            case DirExe:
                basePath = boost::filesystem::current_path();
                break;
            case DirAppData:
                basePath = "/home/web_user/.local/share/Roblox2";
                break;
            case DirPicture:
                basePath = "/home/web_user/Pictures/Roblox2";
                break;
            case DirVideo:
                basePath = "/home/web_user/Videos/Roblox2";
                break;
            default:
                basePath = "/home/web_user/Roblox2"; // fallback
        }
    #else
        switch(dir)
        {
            case DirExe:
                basePath = boost::filesystem::current_path();
                break;
            case DirAppData:
            {
                const char* home = getenv("HOME");
                if (home)
                    basePath = boost::filesystem::path(home) / ".local/share/Roblox2";
                else
                    basePath = "/tmp/Roblox2"; // fallback
                break;
            }
            case DirPicture:
            {
                const char* home = getenv("HOME");
                if (home)
                    basePath = boost::filesystem::path(home) / "Pictures/Roblox2";
                else
                    basePath = "/tmp/Roblox2";
                break;
            }
            case DirVideo:
            {
                const char* home = getenv("HOME");
                if (home)
                    basePath = boost::filesystem::path(home) / "Videos/Roblox2";
                else
                    basePath = "/tmp/Roblox2";
                break;
            }
            default:
            {
                const char* home = getenv("HOME");
                if (home)
                    basePath = boost::filesystem::path(home) / "Roblox2";
                else
                    basePath = "/tmp/Roblox2";
                break;
            }
        }
    #endif

    if (subDirectory)
    {
        basePath /= subDirectory;
    }

    if (create)
    {
        boost::system::error_code ec;
        boost::filesystem::create_directories(basePath, ec);
        if (ec)
        {
            fprintf(stderr, "Failed to create directories: %s\n", ec.message().c_str());
        }
    }

    return basePath;
}
#endif

boost::filesystem::path getCacheDirectory(bool create, const char* subDirectory)
{
    return getUserDirectory(create, DirAppData, subDirectory);
}

boost::filesystem::path getTempFilePath()
{
    return getUserDirectory(true, DirAppData, "temp");
}

void clearCacheDirectory(const char* subDirectory)
{
    boost::filesystem::path cachePath = getCacheDirectory(false, subDirectory);
    namespace fs = boost::filesystem;
    boost::system::error_code ec;
    if (!cachePath.empty() && fs::exists(cachePath, ec) && !ec)
    {
        fs::directory_iterator end_iter;
        for (fs::directory_iterator iter(cachePath); end_iter != iter; ++iter)
        {
            if (!fs::is_directory(iter->status()))
            {
                boost::filesystem::remove(*iter, ec);
            }
        }
    }
}

} // namespace FileSystem
} // namespace RBX

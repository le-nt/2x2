#include "stdafx.h"

#ifdef _WIN32
#define _WINSOCKAPI_

#include "util/FileSystem.h"

#include <boost/filesystem.hpp>
#include <boost/filesystem/exception.hpp>
#include <boost/filesystem/operations.hpp>
#include <boost/system/error_code.hpp>

#include <shlobj.h>
#include "rbx/Debug.h"
#include "util/standardout.h"

namespace RBX {
namespace FileSystem {

boost::filesystem::path getUserDirectory(bool create, FileSystemDir dir, const char* subDirectory)
{
	if (dir == DirExe)
	{
		WCHAR pathBuffer[MAX_PATH];
		::GetModuleFileNameW(0, pathBuffer, MAX_PATH);
		boost::filesystem::path path(pathBuffer);
		path.remove_filename();

		if (subDirectory)
		{
			path /= subDirectory;
			if (create)
			{
				boost::system::error_code ec;
				boost::filesystem::create_directories(path, ec);
			}
		}

		return path;
	}

	DWORD flags = create ? CSIDL_FLAG_CREATE : 0;
	boost::filesystem::path robloxDir = L"Roblox2";
	if (subDirectory)
		robloxDir /= boost::filesystem::path(subDirectory);

	WCHAR pathBuffer[MAX_PATH];
	HRESULT hr;

	switch (dir)
	{
	case DirAppData:
		hr = SHGetFolderPathAndSubDirW(NULL, CSIDL_LOCAL_APPDATA | flags, NULL, SHGFP_TYPE_CURRENT, robloxDir.native().c_str(), pathBuffer);
		break;
	case DirPicture:
		hr = SHGetFolderPathAndSubDirW(NULL, CSIDL_MYPICTURES | flags, NULL, SHGFP_TYPE_CURRENT, robloxDir.native().c_str(), pathBuffer);
		break;
	case DirVideo:
		hr = SHGetFolderPathAndSubDirW(NULL, CSIDL_MYVIDEO | flags, NULL, SHGFP_TYPE_CURRENT, robloxDir.native().c_str(), pathBuffer);
		break;
	default:
		RBXASSERT(false);
		hr = S_FALSE;
		break;
	}

	if ((hr != S_OK) && (dir == DirAppData))
	{
		hr = SHGetFolderPathAndSubDirW(NULL, CSIDL_COMMON_APPDATA | flags, NULL, SHGFP_TYPE_CURRENT, robloxDir.native().c_str(), pathBuffer);
	}

	if (hr == S_OK)
		return boost::filesystem::path(pathBuffer);
	else
		return boost::filesystem::path();
}

boost::filesystem::path getCacheDirectory(bool create, const char* subDirectory)
{
	return boost::filesystem::path( getUserDirectory(true, DirAppData, subDirectory) );
}

boost::filesystem::path getTempFilePath()
{
	return boost::filesystem::path( getUserDirectory(true, DirAppData, "temp") );
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
				boost::system::error_code ec;
				boost::filesystem::remove(*iter, ec);
			}
		}
	}
}

} // namespace FileSystem
} // namespace RBX
#endif // _WIN32

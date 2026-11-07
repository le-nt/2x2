#include "stdafx.h"

#include "util/LegacyContentTable.h"
#include <boost/algorithm/string/predicate.hpp>

FASTFLAGVARIABLE(DebugRenderDownloadAssets, false)

namespace RBX
{
	LegacyContentTable::LegacyContentTable()
	{

	}
	
	void LegacyContentTable::AddEntry(const std::string& path, const std::string& contentId)
	{
		
	}
	
	void LegacyContentTable::AddEntryProd(const std::string& path, const std::string& contentId)
	{

	}
	
	const std::string& LegacyContentTable::FindEntry(const std::string& path)
	{
		return "";
	}
}

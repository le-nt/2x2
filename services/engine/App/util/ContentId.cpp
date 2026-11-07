#include "stdafx.h"

#include "util/ContentId.h"
#include "util/Http.h"
#include "util/Statistics.h"
#include <boost/functional/hash.hpp>
#include <boost/algorithm/string.hpp>

#include "util/LegacyContentTable.h"

#include "util/URL.h"

DYNAMIC_FASTFLAGVARIABLE(UrlReconstructToAssetGame, false);
DYNAMIC_FASTFLAGVARIABLE(UrlReconstructToAssetGameSecure, false);
DYNAMIC_FASTFLAGVARIABLE(UrlReconstructRejectInvalidSchemes, false);

namespace
{			
	const char* kNamedUniverseAssetBase = "rbxgameasset://";
	const char* kNamedUniverseAssetAssetNameParam = "assetName=";

	const char* kValidAssetPaths[] =
	{
		// assets
		"asset",
		"asset/",
		"asset/bodycolors.ashx",
		// thumbnails
		"thumbs/asset.ashx",
		"thumbs/avatar.ashx",
		"thumbs/script.png",
		"thumbs/staticimage",
		"game/tools/thumbnailasset.ashx",
		// scripts
		"game/edit.ashx",
		"game/gameserver.ashx",
		"game/join",
		"game/visit"
	};

	void createIdUrl(std::string& result, const std::string& baseUrl, const std::string& id)
	{
		result.reserve(baseUrl.size() + id.size() + 16);
		
		result = baseUrl;
		
		// append slash only if baseUrl does not end with one
		if (result.empty() || result[result.size() - 1] != '/')
			result += '/';
		
		result += "asset/?id=";
		result += id;
	}
}


namespace RBX
{
    static boost::once_flag legacyContentTableFlag = BOOST_ONCE_INIT;
	static scoped_ptr<LegacyContentTable> legacyContentTable;

    static void initLegacyContentTable()
    {
        legacyContentTable.reset(new LegacyContentTable);
    }

	bool operator<(const ContentId& a, const ContentId& b) {
		return a.id < b.id;
	}
	bool operator!=(const ContentId& a, const ContentId& b) {
		return a.id != b.id;
	}
	bool operator==(const ContentId& a, const ContentId& b) {
		return a.id == b.id;
	}
	ContentId ContentId::fromUrl(const std::string& url) {
		// TODO: Throw if string isn't a real Url?
		return ContentId(url);
	}

	ContentId ContentId::fromGameAssetName(const std::string& gameAssetName)
	{
		return ContentId(kNamedUniverseAssetBase + gameAssetName);
	}

	void ContentId::CorrectBackslash(std::string& id)
	{
		for (size_t i = 0; i < id.size(); ++i)
			if (id[i] == '\\')
				id[i] = '/';
	}
	
	bool ContentId::isNamedAsset() const
	{
		return id.compare(0, strlen(kNamedUniverseAssetBase), kNamedUniverseAssetBase) == 0;
	}

	bool ContentId::isConvertedNamedAsset() const
	{
		return id.find(kNamedUniverseAssetAssetNameParam) != std::string::npos;
	}

	void ContentId::convertAssetId(const std::string& baseUrl, int universeId)
	{
		if(isAssetId())
			createIdUrl(id, baseUrl, id.substr(13));
		else if(isRbxHttp()){
			id = baseUrl + id.substr(10);
		}
		else if (isNamedAsset())
		{
			RBXASSERT(!baseUrl.empty());
			if (!baseUrl.empty())
			{
				std::stringstream ss;
				ss << baseUrl;
				if (baseUrl[baseUrl.size() - 1] != '/')
				{
					ss << '/';
				}
				ss << "asset/"
					<< "?universeId=" << universeId
					<< "&" << kNamedUniverseAssetAssetNameParam << RBX::Http::urlEncode(id.substr(strlen(kNamedUniverseAssetBase)))
					<< "&skipSigningScripts=1";

				id = ss.str();
			}
		}
	}
	
	void ContentId::convertToLegacyContent(const std::string& baseUrl)
	{	
		/*if (isAsset())
		{
            boost::call_once(initLegacyContentTable, legacyContentTableFlag);

			const std::string& mappedAssetId = legacyContentTable->FindEntry(id);
			
			if (!mappedAssetId.empty())
            {
                if (isdigit(mappedAssetId[0]))
                    createIdUrl(id, baseUrl, mappedAssetId);
                else
                    id = mappedAssetId;
            }
		}*/
	}

	bool ContentId::reconstructUrl(const std::string& baseUrl, const char* const paths[], const int pathCount)
	{
		std::string cleanId;
		cleanId.reserve(id.size());
		for (char c : id)
			if (c != ' ') cleanId += c;

		const RBX::Url parsed = RBX::Url::fromString(cleanId);

		if (!parsed.hasHttpScheme())
			return !DFFlag::UrlReconstructRejectInvalidSchemes || parsed.hasValidScheme();

		if (!parsed.isValid() || parsed.pathIsEmpty())
			return true;

		const RBX::Url baseUrlParsed = RBX::Url::fromString(baseUrl);
		if (!baseUrlParsed.isValid())
			return true;

		std::string path = parsed.path();
		if (path.compare(0, 5, "/api/") != 0)
			path = "/api" + (path.front() == '/' ? path : "/" + path);

		if (path.length() > 1 && path.back() == '/')
			path.pop_back();

		for (int i = 0; i < pathCount; ++i)
		{
			if (parsed.pathEqualsCaseInsensitive(paths[i]))
			{
				// Reconstruct with base URL host and HTTPS scheme
				id = RBX::Url::fromComponents(
					"https",
					baseUrlParsed.host(),
					path,
					parsed.query(),
					parsed.fragment()
				).asString();
				return true;
			}
		}

		return true;
	}

	bool ContentId::reconstructAssetUrl(const std::string& baseUrl)
	{
		return reconstructUrl(baseUrl, kValidAssetPaths, ARRAYSIZE(kValidAssetPaths));
	}

	std::string ContentId::getAssetId() const
	{
		if(isAssetId()){
			return id.substr(13); 
		}
		else if(isHttp() || isRbxHttp()){
			std::string lower = id;
			std::transform(lower.begin(), lower.end(), lower.begin(), tolower);
			std::string::size_type pos = lower.find("id=");
			if(pos != std::string::npos){
				pos += 3;
				std::string::size_type second_pos = lower.find('&',pos);
				if(second_pos == std::string::npos){
					second_pos = lower.size();
				}
				return lower.substr(pos, (second_pos-pos));
			}
		}
		return "";
	}

	std::string ContentId::getAssetName() const
	{
		if (!isNamedAsset())
		{
			return "";
		}
		return id.substr(strlen(kNamedUniverseAssetBase));
	}

	std::string ContentId::getUnConvertedAssetName() const
	{
		if (!isConvertedNamedAsset())
		{
			return "";
		}
		std::string::size_type namedAssetParamPos = id.find(kNamedUniverseAssetAssetNameParam) +
			strlen(kNamedUniverseAssetAssetNameParam);
		std::string::size_type namedAssetParamEnd = id.find("&", namedAssetParamPos);
		std::string::size_type namedAssetParamLength = 
			namedAssetParamEnd == std::string::npos ?
				std::string::npos : namedAssetParamEnd - namedAssetParamPos;

		std::string urlEncodedNamedAsset = id.substr(namedAssetParamPos, namedAssetParamLength);
		return Http::urlDecode(urlEncodedNamedAsset);
	}

	ContentId ContentId::fromAssets(const char* filePath) {
		std::string header("rbxasset://");
		return ContentId(header + filePath);
	}

	std::size_t hash_value(const ContentId& id)
	{
		boost::hash<std::string> hasher;
		return hasher(id.toString());
	}
}

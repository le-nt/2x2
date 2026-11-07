/**
 * RobloxNetworkAccessManager.h
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#pragma once

// Qt Headers
#include <QNetworkAccessManager>

class RobloxNetworkReply;
class RobloxCookieJar;

class RobloxNetworkAccessManager : public QNetworkAccessManager
{
public:
    static RobloxNetworkAccessManager* Instance()
    {
        if (!instance)
            instance = new RobloxNetworkAccessManager();
        return instance;
    }

	static void DestroyInstance()
    {
        delete instance;
        instance = nullptr;
    }

	QString getUserAgent();
	RobloxNetworkReply* get(const QNetworkRequest& request, bool followRedirection = true);
	RobloxCookieJar* cookieJar() const;
private:
	RobloxNetworkAccessManager();
	void initUserAgent();

	QString userAgent;
	static RobloxNetworkAccessManager* instance;
};
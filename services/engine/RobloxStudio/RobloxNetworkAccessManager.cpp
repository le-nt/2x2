/**
 * RobloxNetworkAccessManager.cpp
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#include "stdafx.h"
#include "RobloxNetworkAccessManager.h"
#include "RobloxWebPage.h"
#include <QWebEngineProfile>
#include <QWebEngineCookieStore>
#include <QNetworkCookieJar>

// Roblox Headers
#include "QtUtilities.h"
#include "RobloxCookieJar.h"
#include "RobloxSettings.h"
#include "RobloxNetworkReply.h"
#include "AuthenticationHelper.h"

RobloxNetworkAccessManager* RobloxNetworkAccessManager::instance = nullptr;

RobloxNetworkAccessManager::RobloxNetworkAccessManager()
: QNetworkAccessManager()
{
    RobloxCookieJar* jar = new RobloxCookieJar();
    setCookieJar(jar);

    QWebEngineProfile* profile = RobloxWebPage::getSharedProfile();
    if (!profile)
    {
        return;
    }

    QWebEngineCookieStore* webCookieStore = profile->cookieStore();
    if (!webCookieStore)
    {
        return;
    }

	connect(webCookieStore, &QWebEngineCookieStore::cookieAdded, this, [jar](const QNetworkCookie& cookie){
		qDebug() << "Cookie added:" << cookie.name();
        jar->insertCookie(cookie);
		
		if(cookie.name() == ".ROBLOSECURITY")
		{
			AuthenticationHelper::Instance().authenticateUserAsync(RobloxSettings::getBaseURL() + "/users/set-token", cookie.value());
		}
    });
    webCookieStore->loadAllCookies();
}

void RobloxNetworkAccessManager::initUserAgent()
{
	// Set up our useragent
	userAgent = /*dummy.getDefaultUserAgent()*/ "ROBLOX Studio Qt 6";
	
	// Only on Mac webkit does not provide the OSX version, add it, will do only for Mac
	QString macOSXVersion = QtUtilities::getMacOSXVersion();
	userAgent = userAgent.replace("Mac OS X", macOSXVersion);
}
QString RobloxNetworkAccessManager::getUserAgent()
{
	if (userAgent.isEmpty())
		initUserAgent();
	return userAgent;
}

RobloxNetworkReply* RobloxNetworkAccessManager::get(const QNetworkRequest& request, bool followRedirection /*= true*/ )
{
	QNetworkReply* reply = QNetworkAccessManager::get(request);
	RobloxNetworkReply* robloxreply = new RobloxNetworkReply(reply, followRedirection);
	return robloxreply;
}

RobloxCookieJar* RobloxNetworkAccessManager::cookieJar() const
{
	return dynamic_cast<RobloxCookieJar*>(QNetworkAccessManager::cookieJar());
}

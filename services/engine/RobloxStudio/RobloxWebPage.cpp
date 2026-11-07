/**
 * RobloxWebPage.cpp
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#include "stdafx.h"
#include "RobloxWebPage.h"

// Qt Headers
#include <QDesktopServices>
#include <QNetworkReply>
#include <QWebEnginePage>
#include <QKeyEvent>
#include <QCoreApplication>
#include <QWebEngineSettings>
#include <QWebEngineCookieStore>
#include <qwebengineprofile.h>

// Roblox Headers
#include "AuthenticationHelper.h"
#include "FastLog.h"
#include "RobloxBrowser.h"
#include "RobloxNetworkAccessManager.h"
#include "RobloxSettings.h"
#include "RobloxCookieJar.h"
#include "QtUtilities.h"
#include "util/RobloxGoogleAnalytics.h"

QString RobloxWebPage::userAgentForUrl(const QUrl &url) const 
{	
	return RobloxNetworkAccessManager::Instance()->getUserAgent();
}

QWebEngineProfile* RobloxWebPage::getSharedProfile()
{
    static QWebEngineProfile* sharedProfile = nullptr;
    if (!sharedProfile)
    {
        sharedProfile = new QWebEngineProfile("PizzaBlox");
		sharedProfile->setPersistentCookiesPolicy(QWebEngineProfile::NoPersistentCookies);

		auto baseURL = RobloxSettings::getWebURL();
		auto authCookie = RobloxNetworkAccessManager::Instance()->cookieJar()->getCookieValue(baseURL, ".ROBLOSECURITY");
		if (!authCookie.isEmpty())
		{
			QNetworkCookie cookie;
			cookie.setName(".ROBLOSECURITY");
			cookie.setValue(authCookie.toUtf8());
			cookie.setDomain(baseURL);
			cookie.setPath("/");
			cookie.setExpirationDate(QDateTime::currentDateTimeUtc().addYears(10));
			sharedProfile->cookieStore()->setCookie(cookie, baseURL);
		}
	
		QWebEngineSettings* globalSetting = sharedProfile->settings();
		globalSetting->setAttribute(QWebEngineSettings::AutoLoadImages, true);
		
		globalSetting->setAttribute(QWebEngineSettings::JavascriptEnabled, true);
		globalSetting->setAttribute(QWebEngineSettings::JavascriptCanAccessClipboard, true);
		globalSetting->setAttribute(QWebEngineSettings::JavascriptCanOpenWindows, true);

		globalSetting->setAttribute(QWebEngineSettings::LocalContentCanAccessRemoteUrls, true);
		globalSetting->setAttribute(QWebEngineSettings::LocalContentCanAccessFileUrls, true);
    }
    return sharedProfile;
}

RobloxWebPage::RobloxWebPage(QWidget* parent) 
    : QWebEnginePage(getSharedProfile(), parent)
{
	//setNetworkAccessManager(&RobloxNetworkAccessManager::Instance());
	connect(this, &RobloxWebPage::certificateError, this, &RobloxWebPage::onCertificateError);
}

bool RobloxWebPage::event(QEvent *evt)
{
	if (evt->type() == QEvent::ContextMenu)
       m_contextPos = static_cast<QContextMenuEvent*>(evt)->pos();

	return QWebEnginePage::event(evt);
}

void RobloxWebPage::onCertificateError(QWebEngineCertificateError error) {
	#ifdef DEBUG 
		qWarning() << "Ignoring certificate error: " << error.description();  
		auto mutableError = const_cast<QWebEngineCertificateError&>(error);
		mutableError.acceptCertificate();
	#else
	    qCritical() << "Certificate error: " << error.description();
	#endif
}
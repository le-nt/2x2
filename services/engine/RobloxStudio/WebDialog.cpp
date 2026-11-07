/**
 * WebDialog.cpp
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#include "stdafx.h"
#include "WebDialog.h"

// Qt Headers
#include <QWebEngineSettings>
#include <QCloseEvent>
#include <QWebEngineProfile>
#include <QWebEngineScriptCollection>
#include <QWebChannel>
#include <QFile>

// Roblox Headers
#include "util/Statistics.h"

// Roblox Studio Headers
#include "RbxWorkspace.h"
#include "RobloxBrowser.h"
#include "RobloxSettings.h"
#include "RobloxWebPage.h"
#include "QtUtilities.h"
#include "AuthenticationHelper.h"

FASTFLAG(WebkitLocalStorageEnabled);
FASTFLAG(WebkitDeveloperToolsEnabled);
FASTFLAG(StudioEnableWebKitPlugins);

WebDialog::WebDialog(QWidget* parent, const QString& initialUrl, RBX::DataModel *dm, int widthInPixels, int heightInPixels)
: RobloxSavingStateDialog<QDialog>(parent, "WebDialog/Geometry")
, m_initialUrl(initialUrl)
, m_pWebView(NULL)
, m_pDataModel(dm)
, m_iWidthInPixels(widthInPixels)
, m_iHeightInPixels(heightInPixels)
{
	// Webview
	m_pWebView = new RobloxBrowser(this);
	m_pWebPage = new RobloxWebPage(m_pWebView);
	m_pWebView->setPage(m_pWebPage);
		
	load(m_initialUrl);
	
	m_pWorkspace.reset(new RbxWorkspace(this, m_pDataModel));
	connect(m_pWorkspace.get(), SIGNAL(closeEvent()), this, SLOT(close()));
	connect(m_pWorkspace.get(), SIGNAL(hideEvent()), this, SLOT(hide()));
	connect(m_pWorkspace.get(), SIGNAL(showEvent()), this, SLOT(show()));

	//connect(m_pWebView->page()->mainFrame(), SIGNAL(javaScriptWindowObjectCleared()), this, SLOT(initJavascript()));  
	connect(m_pWebPage, SIGNAL(windowCloseRequested()), this, SLOT(close()));
	initJavascript();

	setSizePolicy(QSizePolicy::Preferred, QSizePolicy::Preferred);
	QtUtilities::updateWindowTitle(this);
}

void WebDialog::load(const QString& url)
{
	m_pWebView->load(url);	
}

void WebDialog::initJavascript()
{
	//m_pWebView->page()->mainFrame()->addToJavaScriptWindowObject("external", m_pWorkspace.get() );
	//hack to get window.close() working with webkit
	//m_pWebView->page()->mainFrame()->evaluateJavaScript("window.open('', '_self')");
	m_pWorkspace->disconnect();
	QWebChannel* channel = new QWebChannel();
	m_pWebView->page()->setWebChannel(channel);
	channel->registerObject(QString("roblox"), m_pWorkspace.get());

	QFile webChannelFile(":/qtwebchannel/qwebchannel.js");
	if (!webChannelFile.open(QIODevice::ReadOnly))
	{
		qWarning() << "Failed to open qwebchannel.js";
		return;
	}
	QString jsStr = QString::fromUtf8(webChannelFile.readAll());
	webChannelFile.close();

	QWebEngineScript webChannelScript;
    webChannelScript.setName("qwebchannel.js"); 
    webChannelScript.setInjectionPoint(QWebEngineScript::DocumentCreation);
    webChannelScript.setRunsOnSubFrames(false);
    webChannelScript.setWorldId(QWebEngineScript::MainWorld);
    webChannelScript.setSourceCode(jsStr);
	m_pWebView->page()->scripts().insert(webChannelScript);
}

void WebDialog::resizeEvent( QResizeEvent* evt )
{
	QDialog::resizeEvent(evt);
	
	m_pWebView->resize(width(), height());
}

QSize WebDialog::sizeHint() const
{
	return QSize(m_iWidthInPixels, m_iHeightInPixels);
}

UploadDialog::UploadDialog(QWidget* parent, RBX::DataModel* dataModel)
: WebDialog(parent, QString("%1/Game/upload").arg(RobloxSettings::getWebURL()), dataModel)
{
	setWindowModality(Qt::WindowModal);
}

void UploadDialog::reject()
{    
    QDialog::reject();
    setResult(CANCEL);
}

void UploadDialog::closeEvent(QCloseEvent* evt)
{
    setResult(CANCEL);

	//QWebElement dialogResult = m_pWebView->page()->mainFrame()->findFirstElement("#DialogResult");
	//if ( !dialogResult.isNull() )
	//{
		//QString value = dialogResult.attribute("value");
		//if ( value == "1" )
			//setResult(OK);
		//else if ( value == "2" )
			//setResult(CANCEL);
		//else if ( value == "3" )
			//setResult(LOCAL_SAVE);
	//}

	evt->accept();
}





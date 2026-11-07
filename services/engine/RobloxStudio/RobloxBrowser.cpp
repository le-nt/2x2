/**
 * RobloxBrowser.cpp
 * Copyright (c) 2013 ROBLOX Corp. All Rights Reserved.
 */

#include "stdafx.h"
#include "RobloxBrowser.h"
#include "FastLog.h"

// Qt Headers
#include <QContextMenuEvent>
#include <QDialog>
#include <QFileInfo>
#include <QWebEngineView>
#include <QMimeData>

// Roblox Studio Headers
#include "RobloxMainWindow.h"
#include "UpdateUIManager.h"

LOGVARIABLE(BrowserActivity, 0)
FASTFLAGVARIABLE(WebkitLocalStorageEnabled, false)
FASTFLAGVARIABLE(WebkitDeveloperToolsEnabled, false)

RobloxBrowser::RobloxBrowser(QWidget* parent) 
    : QWebEngineView(parent)
    , m_pPopup(NULL)
    , m_pPopupDlg(NULL)
    , m_loadingTimer(NULL)
    , m_refreshIncr(0.0f)
{
    connect(this, SIGNAL(loadStarted()), this, SLOT(loadStarted()));
    connect(this, SIGNAL(loadFinished(bool)), this, SLOT(loadFinished(bool)));
    //setAcceptDrops(true);
}

RobloxBrowser::~RobloxBrowser()
{
}

void RobloxBrowser::dropEvent(QDropEvent *evt)
{
	const QMimeData *pMimeData = evt->mimeData();

	if (pMimeData && pMimeData->hasUrls())
	{
		QList<QUrl> urlList = pMimeData->urls();
		for (int i = 0; i < urlList.size() && i < 6; ++i) 
		{
			QString fileName = urlList.at(i).toLocalFile();
			if (!fileName.isEmpty())
			{
				if (fileName.endsWith(".rbxl", Qt::CaseInsensitive) || fileName.endsWith(".rbxlx", Qt::CaseInsensitive))
				{
					UpdateUIManager::Instance().getMainWindow().handleFileOpen(fileName, IRobloxDoc::IDE);
				}
			}
		}
	}

	evt->acceptProposedAction();
}

bool RobloxBrowser::close()
{
	if(m_pPopupDlg) 
		m_pPopupDlg->close();
	return true; 
}

void RobloxBrowser::loadStarted()
{
    FASTLOGS(FLog::BrowserActivity, "URL: %s", url().toString().toStdString().c_str());
    resetLoadingTimer();
}

void RobloxBrowser::loadFinished(bool)
{
    if (m_loadingTimer)
    {
        m_loadingTimer->stop();
        delete m_loadingTimer;
        m_loadingTimer = NULL;
    }
    
    //update();
}

void RobloxBrowser::resetLoadingTimer()
{
    if (m_loadingTimer)
    {
        m_loadingTimer->stop();
        delete m_loadingTimer;
        m_loadingTimer = NULL;
    }
    
    m_loadingTimer = new QTimer(this);
    connect(m_loadingTimer, SIGNAL(timeout()), this, SLOT(update()));
    m_loadingTimer->start(1000/30);
    m_refreshIncr = 0;
}